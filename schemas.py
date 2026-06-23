from pydantic import BaseModel, EmailStr, ConfigDict, field_validator, UUID4
from uuid import UUID
from datetime import datetime, date
from typing import Optional, List
from models import RoleUtilisateur, StatutWorkflow

class UtilisateurBase(BaseModel):
  nom: str
  prenom: str
  email: EmailStr   # Validation automatique du format de l'email
  role: RoleUtilisateur
  
class UtilisateurCreate(UtilisateurBase):
  mot_de_passe: str   #Reçu en clair, il sera haché dans le backend avant d'aller en DB
  @field_validator('mot_de_passe')
  @classmethod
  def validator_mot_de_passe(cls, v: str):
    if len(v) < 8 :
      raise ValueError("Le mot de passe doit contenir au moins 8 caractères !")
    if not any(char.isalpha() for char in v):
      raise ValueError("Le mot de passe doit contenir au moins 1 lettre !")
    if not any(char.isdigit() for char in v):
      raise ValueError("Le mot de passe doit contenir au moins un chiffre !")
    
    caracteres_speciaux = "@/?&#§!-$_"
    if not any (char in caracteres_speciaux for char in v):
      raise ValueError("Le mot de passe doit contenir au moins un caractère spécial parmi : {caracteres_speciaux} !")
    return v
  
class UtilisateurUpdate(BaseModel):
  nom: Optional[str] = None
  prenom: Optional[str] = None
  email: Optional[EmailStr] = None
  role: Optional[RoleUtilisateur] = None
  mot_de_passe: Optional[str] = None

  @field_validator('mot_de_passe')
  @classmethod
  def valider_nouveau_mot_de_passe(cls, v: Optional[str]) -> Optional[str]:
    if v is not None:
      UtilisateurCreate.validator_mot_de_passe(v)
    return v

class UtilisateurResponse(UtilisateurBase):
  id: UUID
  
  model_config = ConfigDict(from_attributes=True)
  

class ChantierBase(BaseModel):
  nom_chantier: str
  
class ChantierCreate(ChantierBase):
  pass

class ChantierResponse(ChantierBase):
  id: UUID
  date_creation: datetime
  
  model_config = ConfigDict(from_attributes=True)
  
class GalerieBase(BaseModel):
  nom_galerie: str
  numero: Optional[int] = None 
  pm_debut: Optional[float] = None
  pm_fin: Optional[float] = None
  diametre: Optional[float] = None
  
class GalerieCreate(GalerieBase):
  chantier_id: UUID   # Requis pour lier la galerie à un chantier à la création
  
class GalerieResponse(GalerieBase):
  id: UUID
  chantier_id: UUID
  
  model_config = ConfigDict(from_attributes=True)
  
class OxydationBase(BaseModel):
  '''profondeur: float
  degre_oxydation: Optional[str] = None
  remarques: Optional[str] = None'''
  
  forage: Optional[str] = None
  temps_apres_carottage_h: Optional[float] = None
  temps_apres_creusement_j: Optional[float] = None
  # Dans schemas.py
  gypse: Optional[float] = None
  bioturbations_oxydees: Optional[float] = None
  patine_oxydation: Optional[float] = None
  oxydation_masse: Optional[float] = None
  gypse_sur_debris: Optional[float] = None
  bioturbations_sur_debris: Optional[float] = None
  patine_sur_debris: Optional[float] = None
  
class OxydationCreate(OxydationBase):
  forage_id: UUID4   
  
class OxydationResponse(OxydationBase):
  id: UUID4
  forage_id: UUID4
  date_mesure: datetime
  
  class Config:
    from_attributes = True


class DiagraphieBase(BaseModel):
  profondeur_debut: float
  profondeur_fin: float
  type_mesure: Optional[str] = None
  valeur_mesure: Optional[float] = None
  
class DiagraphieCreate(DiagraphieBase):
  forage_id: UUID
  
class DiagraphieResponse(DiagraphieBase):
  id: UUID
  forage_id: UUID
  date_mesure: datetime
  
  model_config = ConfigDict(from_attributes=True)
  

class MediaBase(BaseModel):
  chemin_fichier: str
  description: Optional[str] = None
  
class MediaCreate(MediaBase):
  forage_id: UUID
  
class MediaResponse(MediaBase):
  id: UUID
  forage_id: UUID
  date_capture: datetime
  
  model_config = ConfigDict(from_attributes=True)

class ForageBase(BaseModel):
  forage: str  # ⚠️ Obligatoire
  campagne: Optional[str] = None
  galerie: Optional[str] = None
  galerie_proche: Optional[str] = None
  pm: Optional[float] = None
  situation: Optional[str] = None
  debut_du_suivi: Optional[date] = None
  fin_du_suivi: Optional[date] = None
  longueur: Optional[float] = None
  distance_ref_par: Optional[float] = None
  diametre_forage: Optional[float] = None
  gisement: Optional[float] = None
  inclinaison: Optional[float] = None
  numero_rapport: Optional[str] = None
  x_tete: Optional[float] = None
  x_pied: Optional[float] = None
  y_tete: Optional[float] = None
  y_pied: Optional[float] = None
  z_tete: Optional[float] = None
  z_pied: Optional[float] = None
  log: Optional[bool] = None
  
class ForageCreate(ForageBase):
  galerie_id: UUID4
  
class ForageResponse(ForageBase):
  id: UUID4
  galerie_id: Optional[UUID4] = None
  cree_par: Optional[UUID4] = None
  statut: Optional[StatutWorkflow] = None
  date_creation: Optional[datetime] = None
  est_actif: Optional[bool] = None
  
  class Config:
    from_attributes = True
  
class ForageUpdate(BaseModel):
  nom_forage: Optional[str] = None
  campagne: Optional[str] = None
  galerie_proche: Optional[str] = None
  pm: Optional[float] = None
  situation: Optional[str] = None
  statut: Optional[StatutWorkflow] = None
  

class ForageCompletResponse(ForageResponse):
  oxydations: List[OxydationResponse] = []
  diagraphies: List[DiagraphieResponse] = []
  medias: List[MediaResponse] = []
  
  model_config = ConfigDict(from_attributes=True)
  
  
# stocker proprement l'email que l'on va extraire du Token
class TokenData(BaseModel):
    email: Optional[str] = None