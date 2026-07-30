from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from uuid import UUID
from datetime import datetime, date
from typing import Optional, List
from models import RoleUtilisateur, StatutWorkflow

class UtilisateurBase(BaseModel):
    nom: str
    prenom: str
    email: EmailStr
    role: RoleUtilisateur

class UtilisateurCreate(UtilisateurBase):
    mot_de_passe: str
    @field_validator('mot_de_passe')
    @classmethod
    def validator_mot_de_passe(cls, v: str):
        if len(v) < 8: raise ValueError("Au moins 8 caractères !")
        if not any(char.isalpha() for char in v): raise ValueError("Au moins 1 lettre !")
        if not any(char.isdigit() for char in v): raise ValueError("Au moins un chiffre !")
        return v

class UtilisateurUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[RoleUtilisateur] = None
    mot_de_passe: Optional[str] = None

class UtilisateurResponse(UtilisateurBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)

class TokenData(BaseModel):
    email: Optional[str] = None

class ChantierBase(BaseModel):
    nom_chantier: str
class ChantierCreate(ChantierBase): pass
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
    chantier_id: UUID
class GalerieResponse(GalerieBase):
    id: UUID
    chantier_id: UUID
    model_config = ConfigDict(from_attributes=True)

class ForageMini(BaseModel):
    forage: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class RapportPDFBase(BaseModel):
    forage: str
    chemin_pdf: Optional[str] = None
    date_validation: Optional[datetime] = None

class RapportPDFCreate(RapportPDFBase):
    forage_id: str

class RapportPDF(RapportPDFBase):
    id: UUID
    forage_id: Optional[str] = None
    valide_par: Optional[UUID] = None
    numero_rapport: Optional[str] = None
    forages: List[ForageMini] = []
    model_config = ConfigDict(from_attributes=True)

class RapportGenerateRequest(BaseModel):
    forages: List[str]
    chemin_dossier: Optional[str] = None
    format: str = "pdf"

class ForageBase(BaseModel):
    forage: str
    nom_fichier: Optional[str] = None
    campagne: Optional[str] = None
    galerie: Optional[str] = None
    galerie_proche: Optional[str] = None
    pm: Optional[float] = None
    situation: Optional[str] = None
    debut_du_suivi: Optional[datetime] = None
    fin_du_suivi: Optional[datetime] = None
    debut_foration: Optional[datetime] = None
    fin_foration: Optional[datetime] = None
    longueur_foree: Optional[float] = None
    distance_ref_par: Optional[float] = None
    diametre: Optional[float] = None
    gisement: Optional[float] = None
    inclinaison: Optional[float] = None
    num_rapport: Optional[str] = None
    type_forage: Optional[str] = None
    orientation_bv: Optional[str] = None
    azimuth_bv: Optional[float] = None
    orientation_strati: Optional[str] = None
    calci: bool = False
    teneur_eau: bool = False
    x_tete: Optional[float] = None
    x_pied: Optional[float] = None
    y_tete: Optional[float] = None
    y_pied: Optional[float] = None
    z_tete: Optional[float] = None
    z_pied: Optional[float] = None
    log: Optional[bool] = None

class ForageCreate(ForageBase):
    galerie_id: Optional[str] = None

class ForageUpdate(BaseModel):
    forage: Optional[str] = None
    campagne: Optional[str] = None
    galerie_proche: Optional[str] = None
    pm: Optional[float] = None
    situation: Optional[str] = None
    statut: Optional[StatutWorkflow] = None

class ForageResponse(ForageBase):
    galerie_id: Optional[str] = None
    cree_par: Optional[UUID] = None
    statut: Optional[StatutWorkflow] = None
    date_creation: Optional[datetime] = None
    est_actif: Optional[bool] = None
    model_config = ConfigDict(from_attributes=True)

# ====== WIZARD (SAISIE TERRAIN) ======
class EnTeteForageCreate(BaseModel):
    nom_forage: str
    nom_fichier: Optional[str] = None
    date_foration: Optional[datetime] = None
    date_debut_suivi: Optional[datetime] = None
    date_fin_suivi: Optional[datetime] = None
    type_forage: Optional[str] = None
    orientation_bv: Optional[str] = None
    azimuth_bv: Optional[float] = None
    orientation_strati: Optional[str] = None
    calci: bool = False
    teneur_eau: bool = False

class GeneratriceCreate(BaseModel):
    num_carotte: Optional[str] = None
    num_generatrice: Optional[str] = None
    orientation_strati: Optional[str] = None
    cote_toit: Optional[float] = None
    cote_mur: Optional[float] = None
    date_heure_suivi: Optional[datetime] = None

class StructureCreate(BaseModel):
    cote: Optional[float] = None
    gen_num: Optional[str] = None
    gen_orientee: Optional[str] = None
    plumoses_fines: bool = False
    plumoses_gross: bool = False
    stries_fines: bool = False
    stries: bool = False
    strie_patine: bool = False
    mixte: bool = False
    indeterminee: bool = False
    remarques: Optional[str] = None
    gypse: bool = False
    bioturbations: bool = False
    patine: bool = False
    mb_dir: Optional[float] = None
    mb_pen: Optional[float] = None
    mb_pitch: Optional[float] = None
    mb_jeu: Optional[str] = None

class ReleveTerrainPayload(BaseModel):
    en_tete: EnTeteForageCreate
    generatrices: List[GeneratriceCreate] = []
    structures: List[StructureCreate] = []

# ====== ECHANTILLONS (FT06b) ======
class EchantillonCreate(BaseModel):
    passe: Optional[str] = None
    identifiant: Optional[str] = None
    type_ech: Optional[str] = None
    nature: Optional[str] = None
    long_toit: Optional[float] = None
    long_mur: Optional[float] = None
    code_etat: Optional[str] = None
    support_type: Optional[str] = None
    support_num: Optional[str] = None
    remarque: Optional[str] = None

class SaisieEchantillonPayload(BaseModel):
    forage_name: str
    date_saisie: Optional[datetime] = None
    echantillons: List[EchantillonCreate] = []

# ====== TENEUR EN EAU (FT32) ======
class TeneurEauCreate(BaseModel):
    identifiant: Optional[str] = None
    coteTete: Optional[float] = None
    cotePied: Optional[float] = None
    h105: Optional[float] = None
    h150: Optional[float] = None
    s105: Optional[float] = None
    s150: Optional[float] = None
    hp105: Optional[float] = None
    hp150: Optional[float] = None

class SaisieTeneurEauPayload(BaseModel):
    forage_name: str
    date_debut: Optional[datetime] = None
    date_fin: Optional[datetime] = None
    mesures: List[TeneurEauCreate] = []