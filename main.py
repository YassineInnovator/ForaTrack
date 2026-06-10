from typing import List
from uuid import UUID
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.openapi.utils import get_openapi
import jwt
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import auth
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import models
import crud
import logging  
import schemas
from database import SessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
  title="API ForaTrack",
  description="Système de gestion et de suivi des données géologiques de forages",
  version="1.0.2"
)

limiter = Limiter(key_func=get_remote_address)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler) # type: ignore

def custom_openapi():
  return get_openapi(
    title=app.title,
    version=app.version,
    description=app.description,
    routes=app.routes,
    )

app.openapi = custom_openapi

@app.middleware("http")
async def add_swagger_no_cache_headers(request: Request, call_next):
  response = await call_next(request)

  if request.url.path in {"/docs", "/redoc", "/openapi.json"}:
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    
  return response


# Dépendance essentielle : Gestion du cycle de vie de la session de base de données
# Elle ouvre une connexion à chaque requête HTTP et la referme automatiquement à la fin
def get_db():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()
    

### routes : Utilisateurs
# Cela indique à FastAPI et à Swagger où se trouve la porte d'entrée pour s'authentifier
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login/")

# --- 1. L'IDENTIFICATION (Qui es-tu ?) ---
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
  credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Token invalide ou expiré",
    headers={"WWW-Authenticate": "Bearer"},
  )
  try:
    payload = jwt.decode(token, str(auth.SECRET_KEY), algorithms=[auth.ALGORITHM])
    email = payload.get("sub")
    if email is None:
      raise credentials_exception
    token_data = schemas.TokenData(email=email)
  except jwt.PyJWTError:
    raise credentials_exception
  
  utilisateur = crud.get_utilisateur_by_email(db, email=email)
  if utilisateur is None:
    raise credentials_exception
  return utilisateur
  
# --- 2. L'AUTORISATION ADMIN (As-tu les droits Admin ?) ---
def get_admin_user(current_user: models.Utilisateur = Depends(get_current_user)):
    # On extrait la valeur et on enlève les espaces invisibles potentiels
    role_actuel = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    role_actuel = role_actuel.strip() 
    
    role_attendu = models.RoleUtilisateur.ADMIN.value.strip()
    
    if role_actuel != role_attendu:
        # DEBUG ULTIME : On affiche les valeurs directement dans l'erreur Swagger !
        message_debug = f"Accès refusé. DEBUG -> La base renvoie : '{role_actuel}' | FastAPI attend : '{role_attendu}'"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=message_debug
        )
        
    return current_user
  
  # --- 3. L'AUTORISATION TERRAIN (As-tu les droits Terrain ?) ---
def get_terrain_utilisateur(current_user: models.Utilisateur = Depends(get_current_user)):
  role_actuel = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
  roles_autorises = [models.RoleUtilisateur.TERRAIN.value, models.RoleUtilisateur.ADMIN.value]
    
  logger.info(f"🔍 Vérification Terrain -> Rôle actuel: '{role_actuel}' | Autorisés: {roles_autorises}")
    
  if role_actuel not in roles_autorises:
        logger.warning(f"❌ Accès refusé pour {current_user.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès refusé. Réservé aux équipes terrain."
        )
  return current_user

@app.post("/login/", tags=["Authentification"])
@limiter.limit("5/minute")
def connexion(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    logger.info(f"--- TENTATIVE DE CONNEXION : {form_data.username} ---")
    
    try:
        # Étape 1 : Recherche en base de données
        logger.info("1. Recherche de l'utilisateur dans la base de données...")
        utilisateur = crud.get_utilisateur_by_email(db, email=form_data.username)
        
        if not utilisateur:
            logger.warning("-> ÉCHEC : Utilisateur introuvable.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email ou mot de passe incorrect",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        logger.info(f"-> Utilisateur trouvé : ID={utilisateur.id}")
        
        # Étape 2 : Vérification du mot de passe
        logger.info("2. Vérification du hash du mot de passe...")
        mot_de_passe_valide = crud.pwd_context.verify(form_data.password, str(utilisateur.mot_de_passe_h))
        
        if not mot_de_passe_valide:
            logger.warning("-> ÉCHEC : Le mot de passe ne correspond pas au hash.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email ou mot de passe incorrect",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        logger.info("-> Mot de passe valide !")

        # Étape 3 : Création du token
        logger.info("3. Génération du token JWT...")
        access_token = auth.create_access_token(data={"sub": utilisateur.email})
        
        logger.info("-> SUCCÈS : Token généré, connexion autorisée !")
        return {"access_token": access_token, "token_type": "bearer"}

    except HTTPException:
        # On laisse passer les erreurs 401 normales
        raise
    except Exception as e:
        # C'EST ICI QU'ON ATTRAPE L'ERREUR 500 !
        logger.error(f"!!! CRASH INTERNE LORS DE LA CONNEXION : {str(e)} !!!", exc_info=True)
        raise HTTPException(status_code=500, detail="Erreur interne du serveur. Regardez les logs.")
    
@app.post("/utilisateurs/", response_model=schemas.UtilisateurResponse, status_code=status.HTTP_201_CREATED, tags=["Utilisateurs"])
def inscrire_utilisateur(utilisateur: schemas.UtilisateurCreate, db: Session = Depends(get_db)):
  # Vérifier si l'email existe déjà
  
  db_utilisateur = crud.get_utilisateur_by_email(db, email=utilisateur.email)
  if db_utilisateur:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Cet email est déjà enregistré."
    )
  return crud.create_utilisateur(db=db, utilisateur=utilisateur)

@app.patch("/utilisateurs/{utilisateur_id}", response_model=schemas.UtilisateurBase, tags=["Utilisateurs"])
def modifier_utilisateur(utilisateur_id: UUID, utilisateur_update: schemas.UtilisateurUpdate, db: Session = Depends(get_db), admin_user : models.Utilisateur = Depends(get_admin_user)):
  db_utilisateur = crud.update_utilisateur(db, utilisateur_id=utilisateur_id, utilisateur_update=utilisateur_update)
  if db_utilisateur is None:
      raise HTTPException(status_code=404, detail="Utilisateur introuvable")
  return db_utilisateur

@app.delete("/utilisateurs/{utilisateur_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Utilisateurs"])
def supprimer_utilisateur(utilisateur_id: UUID, db: Session = Depends(get_db), admin_user : models.Utilisateur = Depends(get_admin_user)):
  deleted_user = crud.delete_utilisateur(db, utilisateur_id=utilisateur_id)
  if not deleted_user:
      raise HTTPException(status_code=404, detail="Utilisateur introuvable")
  return None 
  
@app.get("/utilisateurs/", response_model=List[schemas.UtilisateurResponse], tags=["Utilisateurs"])
def lister_utilisateurs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), admin_user : models.Utilisateur = Depends(get_admin_user)):
  return crud.get_utilisateurs(db, skip=skip, limit=limit)

@app.get("/recherche/utilisateur", response_model=schemas.UtilisateurResponse, tags=["Utilisateurs"])
def chercher_utilisateur_par_email(email: str, db: Session = Depends(get_db), admin_user : models.Utilisateur = Depends(get_admin_user)):
    db_utilisateur = crud.get_utilisateur_by_email(db, email=email)
    if db_utilisateur is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable.")
    return db_utilisateur
  
@app.get("/utilisateurs/{utilisateur_id}", response_model=schemas.UtilisateurResponse, tags=["Utilisateurs"])
def chercher_utilisateur_par_id(utilisateur_id: UUID, db: Session = Depends(get_db), admin_user : models.Utilisateur = Depends(get_admin_user)):
    db_utilisateur = crud.get_utilisateur(db, utilisateur_id=utilisateur_id)
    if db_utilisateur is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable."
        )
    return db_utilisateur


### routes : Chantiers

@app.post("/chantiers/", response_model=schemas.ChantierResponse, status_code=status.HTTP_201_CREATED, tags=["Chantiers"])
def creer_un_chantier(chantier: schemas.ChantierCreate, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    return crud.create_chantier(db=db, chantier=chantier)


@app.get("/chantiers/", response_model=List[schemas.ChantierResponse], tags=["Chantiers"])
def lister_les_chantiers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    return crud.get_chantiers(db, skip=skip, limit=limit)
  


### routes : Forages

@app.post("/forages/", response_model=schemas.ForageResponse, status_code=status.HTTP_201_CREATED, tags=["Forages"])
def creer_un_forage(forage: schemas.ForageCreate, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    # Optionnel : On pourrait vérifier ici si la galerie_id existe bien avant de créer
    return crud.create_forage(db=db, forage=forage)

@app.get("/forages/{forage_id}", response_model=schemas.ForageCompletResponse, tags=["Forages"])
def obtenir_details_forage_complet(forage_id: UUID, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    db_forage = crud.get_forage(db, forage_id=forage_id)
    if db_forage is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Forage introuvable."
        )
    # Grâce aux relationships de SQLAlchemy et à Pydantic, 
    # cela va inclure automatiquement les listes d'oxydations, diagraphies et médias !
    return db_forage
  
# Route de base pour vérifier que le serveur tourne
@app.get("/", tags=["Racine"])
def racine():
    return {"status": "running", "message": "API ForaTrack opérationnelle."}
  
