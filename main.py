from typing import List
from uuid import UUID
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.openapi.utils import get_openapi
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import auth

import crud
import schemas
from database import SessionLocal

app = FastAPI(
  title="API ForaTrack",
  description="Système de gestion et de suivi des données géologiques de forages",
  version="1.0.2"
)

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

@app.post("/login/", tags=["Authentification"])
def connexion(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    utilisateur = crud.get_utilisateur_by_email(db, email=form_data.username)
    
    if not utilisateur or not crud.pwd_context.verify(form_data.password, str(utilisateur.mot_de_passe_h)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(data={"sub": utilisateur.email})
    return {"access_token": access_token, "token_type": "bearer"}
    
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

@app.patch("/utilisateurs/{utilisateur_id}", response_model=schemas.UtilisateurResponse, tags=["Utilisateurs"])
def modifier_utilisateur(utilisateur_id: UUID, utilisateur_update: schemas.UtilisateurUpdate, db: Session = Depends(get_db)):
  db_utilisateur = crud.update_utilisateur(db, utilisateur_id=utilisateur_id, utilisateur_update=utilisateur_update)
  if db_utilisateur is None:
      raise HTTPException(status_code=404, detail="Utilisateur introuvable")
  return db_utilisateur

@app.delete("/utilisateurs/{utilisateur_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Utilisateurs"])
def supprimer_utilisateur(utilisateur_id: UUID, db: Session = Depends(get_db)):
  deleted_user = crud.delete_utilisateur(db, utilisateur_id=utilisateur_id)
  if not deleted_user:
      raise HTTPException(status_code=404, detail="Utilisateur introuvable")
  return None 
  
@app.get("/utilisateurs/", response_model=List[schemas.UtilisateurResponse], tags=["Utilisateurs"])
def lister_utilisateurs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
  return crud.get_utilisateurs(db, skip=skip, limit=limit)

@app.get("/recherche/utilisateur", response_model=schemas.UtilisateurResponse, tags=["Utilisateurs"])
def chercher_utilisateur_par_email(email: str, db: Session = Depends(get_db)):
    db_utilisateur = crud.get_utilisateur_by_email(db, email=email)
    if db_utilisateur is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable.")
    return db_utilisateur
  
@app.get("/utilisateurs/{utilisateur_id}", response_model=schemas.UtilisateurResponse, tags=["Utilisateurs"])
def chercher_utilisateur_par_id(utilisateur_id: UUID, db: Session = Depends(get_db)):
    db_utilisateur = crud.get_utilisateur(db, utilisateur_id=utilisateur_id)
    if db_utilisateur is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable."
        )
    return db_utilisateur


### routes : Chantiers

@app.post("/chantiers/", response_model=schemas.ChantierResponse, status_code=status.HTTP_201_CREATED, tags=["Chantiers"])
def creer_un_chantier(chantier: schemas.ChantierCreate, db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)):
    return crud.create_chantier(db=db, chantier=chantier)


@app.get("/chantiers/", response_model=List[schemas.ChantierResponse], tags=["Chantiers"])
def lister_les_chantiers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_chantiers(db, skip=skip, limit=limit)
  


### routes : Forages

@app.post("/forages/", response_model=schemas.ForageResponse, status_code=status.HTTP_201_CREATED, tags=["Forages"])
def creer_un_forage(forage: schemas.ForageCreate, db: Session = Depends(get_db)):
    # Optionnel : On pourrait vérifier ici si la galerie_id existe bien avant de créer
    return crud.create_forage(db=db, forage=forage)

@app.get("/forages/{forage_id}", response_model=schemas.ForageCompletResponse, tags=["Forages"])
def obtenir_details_forage_complet(forage_id: UUID, db: Session = Depends(get_db)):
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
  
