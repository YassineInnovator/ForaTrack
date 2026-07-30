from typing import List
from uuid import UUID
import csv
import io
import os
from datetime import datetime
import logging  

from fastapi import Depends, FastAPI, HTTPException, Request, status, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
import jwt

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import auth
import models
import crud
import schemas
from database import SessionLocal, engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="API ForaTrack", version="1.0.3")

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler) 

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, 
    allow_methods=["*"], allow_headers=["*"]
)

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()
    
models.Base.metadata.create_all(bind=engine)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login/")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(status_code=401, detail="Token invalide")
    try:
        payload = jwt.decode(token, str(auth.SECRET_KEY), algorithms=[auth.ALGORITHM])
        email = payload.get("sub")
        if email is None: raise credentials_exception
    except jwt.PyJWTError: raise credentials_exception
    user = crud.get_utilisateur_by_email(db, email=email)
    if user is None: raise credentials_exception
    return user

def get_terrain_utilisateur(current_user: models.Utilisateur = Depends(get_current_user)):
    return current_user # Simplified for global usage

@app.post("/login/")
@limiter.limit("5/minute")
def connexion(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    utilisateur = crud.get_utilisateur_by_email(db, email=form_data.username)
    if not utilisateur or not crud.pwd_context.verify(form_data.password, str(utilisateur.mot_de_passe_h)):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    access_token = auth.create_access_token(data={"sub": utilisateur.email})
    crud.enregistrer_action(db=db, utilisateur_id=utilisateur.id, action="Connexion réussie")
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/releve-terrain/")
def enregistrer_saisie_terrain(payload: schemas.ReleveTerrainPayload, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    try:
        nouveau_forage = crud.sauvegarder_releve_terrain(db=db, payload=payload, utilisateur_id=terrain_user.id)
        return {"status": "success", "forage_id": nouveau_forage.forage}
    except Exception as e:
        logger.error(f"Erreur transactionnelle : {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/echantillons/")
def enregistrer_fiche_echantillons(payload: schemas.SaisieEchantillonPayload, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    try:
        forage = crud.sauvegarder_echantillons(db=db, payload=payload, utilisateur_id=terrain_user.id)
        return {"status": "success", "message": f"Échantillons sauvegardés"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/teneur-eau/")
def enregistrer_fiche_teneur_eau(payload: schemas.SaisieTeneurEauPayload, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    try:
        forage = crud.sauvegarder_teneur_eau(db=db, payload=payload, utilisateur_id=terrain_user.id)
        return {"status": "success", "message": f"Teneur Eau sauvegardée"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/calci-dolomimetrie/")
def enregistrer_fiche_calci(payload: schemas.SaisieCalciPayload, db: Session = Depends(get_db), terrain_user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    try:
        forage = crud.sauvegarder_calci_dolomimetrie(db=db, payload=payload, utilisateur_id=terrain_user.id)
        return {"status": "success", "message": "Calci-dolomimétrie sauvegardée"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
@app.get("/afficher/forages/", response_model=List[schemas.ForageResponse])
def lister_tous_les_forages(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), user: models.Utilisateur = Depends(get_terrain_utilisateur)):
    return crud.get_forages(db=db, utilisateur=user, skip=skip, limit=limit)

@app.get("/rapports/", response_model=List[schemas.RapportPDF])
def lister_rapports(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_rapports(db=db, skip=skip, limit=limit)

@app.post("/generer-rapport/")
def generer_et_telecharger_rapport(req: schemas.RapportGenerateRequest, db: Session = Depends(get_db)):
    if not req.forages: raise HTTPException(status_code=400, detail="Aucun forage")
    noms_reduits = "_".join(req.forages)[:30]
    nom_fichier = f"Rapport_Auscultation_{noms_reduits}.pdf"
    dossier = req.chemin_dossier if req.chemin_dossier else "."
    if not os.path.exists(dossier): dossier = "."
    chemin_complet = os.path.join(dossier, nom_fichier)

    c = canvas.Canvas(chemin_complet, pagesize=letter)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, 750, "Rapport d'Auscultation")
    y = 700
    for nom in req.forages:
        c.drawString(70, y, f"- {nom}")
        y -= 20
    c.save()
    
    nouveau_rapport = models.RapportPDF(forage=", ".join(req.forages), chemin_pdf=chemin_complet)
    db.add(nouveau_rapport)
    db.commit()
    return FileResponse(path=chemin_complet, filename=nom_fichier, media_type='application/pdf')

@app.post("/importer/diagraphies/fichier-brut/")
async def importer_fichier_diagrpahie(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contenu = await file.read()
    lecteur = csv.reader(io.StringIO(contenu.decode("utf-8")), delimiter=';')
    compteur = 0
    for index, ligne in enumerate(lecteur, start=1):
        if not ligne or len(ligne) < 11: continue
        nom_forage = ligne[1].replace('"', '')
        corr = db.query(models.Forage).filter(models.Forage.forage == nom_forage).first()
        if corr:
            db.add(models.Diagraphie(forage=corr.forage, profondeur_max=float(ligne[3].replace('"','')) if ligne[3] else None))
            compteur += 1
    db.commit()
    return {"status": "Importation terminée", "diagraphies_inserees": compteur}