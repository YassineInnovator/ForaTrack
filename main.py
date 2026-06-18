from typing import List
from uuid import UUID
import uuid
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
from database import SessionLocal, engine


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
    
models.Base.metadata.create_all(bind=engine)

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
        
        crud.enregistrer_action(db=db, utilisateur_id=utilisateur.id, action="Connexion réussie") # type: ignore
        
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
def inscrire_utilisateur(utilisateur: schemas.UtilisateurCreate, db: Session = Depends(get_db), admin_user : models.Utilisateur = Depends(get_admin_user)):
  # Vérifier si l'email existe déjà
  
  db_utilisateur = crud.get_utilisateur_by_email(db, email=utilisateur.email)
  if db_utilisateur:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail="Cet email est déjà enregistré."
    )
  
  nouvel_utilisateur = crud.create_utilisateur(db=db, utilisateur=utilisateur)
  
  crud.enregistrer_action(
    db= db,
    utilisateur_id = admin_user.id, # type: ignore
    action = f" a crée un nouveau compte pour l'email : {utilisateur.email}" 
  )
  return nouvel_utilisateur


@app.patch("/utilisateurs/{utilisateur_id}", response_model=schemas.UtilisateurBase, tags=["Utilisateurs"])
def modifier_utilisateur(utilisateur_id: UUID, utilisateur_update: schemas.UtilisateurUpdate, db: Session = Depends(get_db), admin_user : models.Utilisateur = Depends(get_admin_user)):
  db_utilisateur = crud.update_utilisateur(db, utilisateur_id=utilisateur_id, utilisateur_update=utilisateur_update)
  
  if db_utilisateur is None:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    
  crud.enregistrer_action(
        db=db,
        utilisateur_id=admin_user.id,  # type: ignore
        action=f"A modifié les informations du compte utilisateur (ID : {utilisateur_id})"
    )
    
  return db_utilisateur

@app.delete("/utilisateurs/{utilisateur_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Utilisateurs"])
def supprimer_utilisateur(utilisateur_id: UUID, db: Session = Depends(get_db), admin_user : models.Utilisateur = Depends(get_admin_user)):
  deleted_user = crud.delete_utilisateur(db, utilisateur_id=utilisateur_id)
  if not deleted_user:
      raise HTTPException(status_code=404, detail="Utilisateur introuvable")
  
  crud.enregistrer_action(
    db=db,
    utilisateur_id=admin_user.id, # type: ignore
    action=f"A supprimé définitivement le compte d'utilisateur {utilisateur_id} !"
  )
  return None 
  
@app.get("/utilisateurs/", response_model=List[schemas.UtilisateurResponse], tags=["Utilisateurs"])
def lister_utilisateurs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user : models.Utilisateur = Depends(get_admin_user)):
  utilisateurs = crud.get_utilisateurs(db, skip=skip, limit=limit)
    
  crud.enregistrer_action(
        db=db, 
        utilisateur_id=current_user.id,  # type: ignore
        action="A consulté la liste globale des utilisateurs"
    )
    
  return utilisateurs

@app.get("/recherche/utilisateur", response_model=schemas.UtilisateurResponse, tags=["Utilisateurs"])
def chercher_utilisateur_par_email(email: str, db: Session = Depends(get_db), admin_user : models.Utilisateur = Depends(get_admin_user)):
    db_utilisateur = crud.get_utilisateur_by_email(db, email=email)
    if db_utilisateur is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable.")
    
    crud.enregistrer_action(
        db=db,
        utilisateur_id=admin_user.id,  # type: ignore
        action=f"A recherché les informations de l'utilisateur par email : {email}"
    )
    
    return db_utilisateur
  
@app.get("/utilisateurs/{utilisateur_id}", response_model=schemas.UtilisateurResponse, tags=["Utilisateurs"])
def chercher_utilisateur_par_id(utilisateur_id: UUID, db: Session = Depends(get_db), admin_user : models.Utilisateur = Depends(get_admin_user)):
    db_utilisateur = crud.get_utilisateur(db, utilisateur_id=utilisateur_id)
    if db_utilisateur is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable."
        )
    
    crud.enregistrer_action(
        db=db,
        utilisateur_id=admin_user.id,  # type: ignore
        action=f"A consulté le profil détaillé de l'utilisateur (ID : {utilisateur_id})"
    )
    
    return db_utilisateur


### routes : Chantiers

@app.post("/chantiers/", response_model=schemas.ChantierResponse, status_code=status.HTTP_201_CREATED, tags=["Chantiers"])
def creer_un_chantier(chantier: schemas.ChantierCreate, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    nouveau_chantier = crud.create_chantier(db=db, chantier=chantier, utilisateur_id=terrain_user.id)# type: ignore
    
    crud.enregistrer_action(
      db=db,
      utilisateur_id=terrain_user.id, #type: ignore
      action=f"{terrain_user.prenom} a crée le chantier {chantier.nom_chantier}"
    )

    return nouveau_chantier
    
@app.get("/chantiers/", response_model=List[schemas.ChantierResponse], tags=["Chantiers"])
def lister_les_chantiers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    chantiers = crud.get_chantiers(db, skip=skip, limit=limit)
  
    crud.enregistrer_action(
      db=db,
      utilisateur_id=terrain_user.id, #type: ignore
      action=f"{terrain_user.prenom} a consulté la liste des chantiers"
    )

    return chantiers
  
### routes : Forages

@app.post("/forages/", response_model=schemas.ForageResponse, status_code=status.HTTP_201_CREATED, tags=["Forages"])
def creer_un_forage(forage: schemas.ForageCreate, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    galerie = crud.get_galerie(db= db, galerie_id=forage.galerie_id)
    
    if not galerie :
      raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, 
        detail="Galerie introuvable."
      )      

    # Cette fonction s'occupe de créer le forage ET d'enregistrer le log en même temps !
    nouveau_forage = crud.create_forage(db= db, forage=forage, utilisateur_id=terrain_user.id) # type: ignore
    
    return nouveau_forage
  
  
@app.get("/forages/{forage_id}", response_model=schemas.ForageCompletResponse, tags=["Forages"])
def obtenir_details_forage_complet(forage_id: UUID, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    db_forage = crud.get_forage(db, forage_id=forage_id) # type: ignore
    if db_forage is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Forage introuvable."
        )
        
    crud.enregistrer_action(
      db= db,
      utilisateur_id=terrain_user.id,# type: ignore
      action=f"{terrain_user.prenom} a consulté(e) les détails du Forage {db_forage.nom_forage}"
    )
    # Grâce aux relationships de SQLAlchemy et à Pydantic, 
    # cela va inclure automatiquement les listes d'oxydations, diagraphies et médias !
    return db_forage
  
@app.get("/rechercher/forages/", response_model=List[schemas.ForageResponse], tags=["Forages"])
def chercher_forage_par_nom( terme_recherche: str, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    forages_trouves = crud.get_forage_by_name(db=db, utilisateur=terrain_user, terme_recherche=terme_recherche)
    
    if not forages_trouves:
      raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"Aucun forage trouvé contenant '{terme_recherche}'"
        )
    
    crud.enregistrer_action(
        db=db,
        utilisateur_id=terrain_user.id,  # type: ignore
        action=f"{terrain_user.prenom} a recherché les forages par mot-clé : '{terme_recherche}' ({len(forages_trouves)} forage(s) trouvé(s))"
    )
    
    return forages_trouves
    
@app.get("/afficher/forages/", response_model=List[schemas.ForageResponse], tags=["Forages"])
def lister_tous_les_forages(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    # On passe le 'terrain_user' complet à la fonction CRUD
    return crud.get_forages(db=db, utilisateur=terrain_user, skip=skip, limit=limit)

@app.patch("/modifier/forages/{forage_id}", response_model=schemas.ForageBase, tags=["Forages"])
def update_forage(forage_id: UUID, forage_update: schemas.ForageUpdate, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
  db_forage = crud.update_forage(db=db, forage_update=forage_update,forage_id=forage_id, utilisateur_id=terrain_user)
  
  if db_forage is None : 
    raise HTTPException(status_code=404, detail="Forage introuvable")
  
  crud.enregistrer_action(
    db=db,
    utilisateur_id=terrain_user.id,  # type: ignore
    action=f"{terrain_user.prenom} a modifié des informations sur le forage {forage_id}"
  ) 
  
  return db_forage

@app.delete("/supprimer/forages/{forage_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Forages"])
def supprimer_forage(forage_id: UUID, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
  deleted_forage = crud.delete_forage(db=db, forage_id=forage_id, utilisateur_id=terrain_user)
  
  if not deleted_forage :
    raise HTTPException(status_code=404, detail="Forage introuvable")
  
  crud.enregistrer_action(
    db=db,
    utilisateur_id=terrain_user.id, # type: ignore
    action=f"{terrain_user.prenom} a supprimé définitivement le Forage {forage_id} !"
  )

@app.post("/galeries/", response_model=schemas.GalerieResponse, tags=["Galeries"])
def creer_galerie(galerie: schemas.GalerieCreate, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
  chantier = crud.get_chantier(db, chantier_id=galerie.chantier_id) # type: ignore
  if not chantier :
    raise HTTPException(status_code=404, detail="Chantier non trouvé")
  
  nouvelle_galerie = crud.create_galerie(db= db, galerie=galerie, utilisateur_id=terrain_user.id) # type: ignore
  
  crud.enregistrer_action(
    db= db,
    utilisateur_id= terrain_user.id, # type: ignore
    action=f"Création de la galerie '{galerie.nom_galerie}' pour le chantier : {chantier.nom_chantier}"
  )
  
  return nouvelle_galerie

@app.get("/chantiers/{chantier_id}/galeries", response_model=List[schemas.GalerieResponse], tags=["Galeries"])
def lister_les_galeries_dun_chantier(chantier_id: UUID ,db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
  
  list_galeries_chantier = crud.get_galeries_by_chantier(db= db, chantier_id=chantier_id)
  
  if list_galeries_chantier is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chantier introuvable."
        )
        
  crud.enregistrer_action(
    db= db,
    utilisateur_id= terrain_user.id, # type: ignore
    action=f"Consultation des galeries du chantier : {chantier_id} par l'ingénieur Terrain : {terrain_user.prenom}"
  )
  
  return list_galeries_chantier

# Route de base pour vérifier que le serveur tourne
@app.get("/", tags=["Racine"])
def racine():
    return {"status": "running", "message": "API ForaTrack opérationnelle."}
  
