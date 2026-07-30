import datetime
import enum
import uuid
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Enum, Date, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class RoleUtilisateur(str, enum.Enum):
    TERRAIN = "TERRAIN"
    BUREAU = "BUREAU"
    ADMIN = "ADMIN"
  
class StatutWorkflow(str, enum.Enum):
    BROUILLON = "BROUILLON"
    EN_ATTENTE_VALIDATION = "EN_ATTENTE_VALIDATION"
    VALIDE = "VALIDE"

class TypeForage(str, enum.Enum):
    Horizontal = "Horizontal"
    Vertical_M = "Vertical_M"
    Vertical_D = "Vertical_D"
    Oblique_M = "Oblique_M"
    Oblique_D = "Oblique_D"

class OrientationStrati(str, enum.Enum):
    H = "H"
    O = "O"
    V = "V"

def obtenir_heure_paris():
    heure_utc = datetime.datetime.utcnow()
    heure_paris = heure_utc + datetime.timedelta(hours=2)
    return heure_paris

class LogAction(Base):
    __tablename__ = "logs_action"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)  
    utilisateur_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id", ondelete="SET NULL"), nullable=True)
    action = Column(String, nullable=False)
    date_action = Column(DateTime, default=obtenir_heure_paris)

class Utilisateur(Base):
    __tablename__ = "utilisateur"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    nom = Column(String(100), nullable=False)
    prenom = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    mot_de_passe_h = Column(String(255), nullable=False)
    role = Column(Enum(RoleUtilisateur, name="role_utilisateur"), nullable=False)
    forages = relationship("Forage", back_populates="createur")

class Chantier(Base):
    __tablename__ = "chantier"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    nom_chantier = Column(String(255), nullable=False)
    date_creation = Column(DateTime, server_default=func.now())
    galeries = relationship("Galeries", back_populates="chantier", cascade="all, delete-orphan")

class Galeries(Base):
    __tablename__ = "galeries"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    nom_galerie = Column(String(100), nullable=False, unique=True)
    numero = Column(Integer)
    pm_debut = Column(Float)
    pm_fin = Column(Float)
    diametre = Column(Float)
    chantier_id = Column(UUID(as_uuid=True), ForeignKey("chantier.id"), nullable=False) 
    chantier = relationship("Chantier", back_populates="galeries")
    forages = relationship("Forage", back_populates="galerie_liee", cascade="all, delete-orphan")

class RapportPDF(Base):
    __tablename__ = "rapport_pdf"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    forage = Column(String(500), nullable=True) 
    numero_rapport = Column(String(50), nullable=True) 
    chemin_pdf = Column(String(255), nullable=True)
    valide_par = Column(UUID(as_uuid=True), nullable=True)
    date_validation = Column(DateTime, nullable=True)
    date_creation = Column(DateTime, default=datetime.datetime.now)
    forages = relationship("Forage", back_populates="rapport")

class Forage(Base):
    __tablename__ = "forage"
    
    # Clé Primaire : le nom en texte (ex: ALC1612)
    forage = Column(String(100), primary_key=True) 
    nom_fichier = Column(String(255), nullable=True)
    rapport_id = Column(UUID(as_uuid=True), ForeignKey("rapport_pdf.id"), nullable=True)
    
    campagne = Column(String(100), nullable=True)
    galerie = Column(String(255), ForeignKey("galeries.nom_galerie"), nullable=True)
    galerie_proche = Column(String(100), nullable=True)
    pm = Column(Float, nullable=True)
    situation = Column(String(255), nullable=True)
    
    debut_du_suivi = Column(DateTime, nullable=True)
    fin_du_suivi = Column(DateTime, nullable=True)
    debut_foration = Column(DateTime, nullable=True)
    fin_foration = Column(DateTime, nullable=True)
    
    longueur_foree = Column(Float, nullable=True)
    distance_ref_par = Column(Float, nullable=True)
    diametre = Column(Float, nullable=True)
    gisement = Column(Float, nullable=True)
    inclinaison = Column(Float, nullable=True)
    num_rapport = Column(String(255), nullable=True)
    
    type_forage = Column(Enum(TypeForage, name="type_forage_enum"), nullable=True)
    orientation_bv = Column(String(50), nullable=True)
    azimuth_bv = Column(Float, nullable=True)
    orientation_strati = Column(Enum(OrientationStrati, name="orientation_strati_enum"), nullable=True)
    calci = Column(Boolean, default=False)
    teneur_eau = Column(Boolean, default=False)
    
    x_tete = Column(Float, nullable=True)
    y_tete = Column(Float, nullable=True)
    z_tete = Column(Float, nullable=True)
    x_pied = Column(Float, nullable=True)
    y_pied = Column(Float, nullable=True)
    z_pied = Column(Float, nullable=True)
    log = Column(Boolean, nullable=True)
      
    statut_workflow = Column(Enum(StatutWorkflow, name="statut_workflow_enum"), default=StatutWorkflow.BROUILLON)
    cree_par = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=True)
    est_actif = Column(Boolean, default=True, index=True)

    # RELATIONS
    galerie_liee = relationship("Galeries", back_populates="forages")
    createur = relationship("Utilisateur", back_populates="forages")
    rapport = relationship("RapportPDF", back_populates="forages")
    
    generatrices = relationship("Generatrice", back_populates="forage_parent", cascade="all, delete-orphan")
    structures = relationship("EDZReel", back_populates="forage_parent", cascade="all, delete-orphan")
    echantillons = relationship("Echantillon", back_populates="forage_parent", cascade="all, delete-orphan")
    oxydations = relationship("Oxydation", back_populates="forage_lie", cascade="all, delete-orphan")
    diagraphies = relationship("Diagraphie", back_populates="forage_ref", cascade="all, delete-orphan")
    medias = relationship("Media", back_populates="forage_parent", cascade="all, delete-orphan")
    teneurs_eau = relationship("TeneurEau", back_populates="forage_parent", cascade="all, delete-orphan")

class Generatrice(Base):
    __tablename__ = "generatrice"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    forage = Column(String(100), ForeignKey("forage.forage", ondelete="CASCADE"), nullable=False)
    num_carotte = Column(String(50), nullable=True)
    num_generatrice = Column(String(50), nullable=True)
    orientation_strati = Column(String(50), nullable=True)
    cote_toit = Column(Float, nullable=True)
    cote_mur = Column(Float, nullable=True)
    date_heure_suivi = Column(DateTime, nullable=True)
    est_actif = Column(Boolean, default=True)
    forage_parent = relationship("Forage", back_populates="generatrices")

class EDZReel(Base):
    __tablename__ = "edz_reel"
    numero = Column(Integer, primary_key=True, autoincrement=True)
    forage = Column(String(100), ForeignKey("forage.forage", ondelete="CASCADE"), nullable=False)
    cote_fracture = Column(Float, nullable=True)
    gen_num = Column(String(50), nullable=True)
    gen_orientee = Column(String(50), nullable=True)
    plumoses_fines = Column(Boolean, default=False)
    plumoses_gross = Column(Boolean, default=False)
    stries_fines = Column(Boolean, default=False)
    stries = Column(Boolean, default=False)
    strie_patine = Column(Boolean, default=False)
    mixte = Column(Boolean, default=False)
    indeterminee = Column(Boolean, default=False)
    remarques = Column(String, nullable=True)
    gypse_struct = Column(Boolean, default=False)
    bioturbations_struct = Column(Boolean, default=False)
    patine_struct = Column(Boolean, default=False)
    direction = Column(Float, nullable=True)
    pendage = Column(Float, nullable=True)
    pitch = Column(Float, nullable=True)
    jeu = Column(String(50), nullable=True)
    est_actif = Column(Boolean, default=True)
    forage_parent = relationship("Forage", back_populates="structures")

class Echantillon(Base):
    __tablename__ = "echantillon"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    forage = Column(String(100), ForeignKey("forage.forage", ondelete="CASCADE"), nullable=False)
    date_prelevement = Column(DateTime, nullable=True)
    passe = Column(String(50), nullable=True)
    identifiant = Column(String(100), nullable=True)
    type_ech = Column(String(50), nullable=True)
    nature = Column(String(100), nullable=True)
    long_toit = Column(Float, nullable=True)
    long_mur = Column(Float, nullable=True)
    code_etat = Column(String(50), nullable=True)
    support_type = Column(String(50), nullable=True)
    support_num = Column(String(50), nullable=True)
    remarque = Column(String, nullable=True)
    est_actif = Column(Boolean, default=True)
    forage_parent = relationship("Forage", back_populates="echantillons")

class TeneurEau(Base):
    __tablename__ = "teneur_eau"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    forage = Column(String(100), ForeignKey("forage.forage", ondelete="CASCADE"), nullable=False)
    identifiant = Column(String(100), nullable=True)
    cote_tete = Column(Float, nullable=True)
    cote_pied = Column(Float, nullable=True)
    h105 = Column(Float, nullable=True)
    h150 = Column(Float, nullable=True)
    s105 = Column(Float, nullable=True)
    s150 = Column(Float, nullable=True)
    hp105 = Column(Float, nullable=True)
    hp150 = Column(Float, nullable=True)
    est_actif = Column(Boolean, default=True)
    forage_parent = relationship("Forage", back_populates="teneurs_eau")

class Oxydation(Base):
    __tablename__ = "oxydation"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    forage_ = Column(String(100), ForeignKey("forage.forage", ondelete="CASCADE"), nullable=False)
    temps_apres_carottage = Column(Float, nullable=True)
    temps_apres_creusement = Column(Float, nullable=True)
    gypse = Column(Float, nullable=True) 
    bioturbations_oxyxdees = Column(Float, nullable=True)
    patine_oxydation = Column(Float, nullable=True)
    oxydation_dans_la_masse = Column(Float, nullable=True)
    gypse_sur_debris = Column(Float, nullable=True)
    bioturbations_sur_debris = Column(Float, nullable=True)
    patine_sur_debris = Column(Float, nullable=True)
    est_actif = Column(Boolean, default=True)
    forage_lie = relationship("Forage", back_populates="oxydations")

class Diagraphie(Base):
    __tablename__ = "diagraphie"
    numero = Column(Integer, primary_key=True, autoincrement=True)
    forage = Column(String(100), ForeignKey("forage.forage", ondelete="CASCADE"), nullable=False)
    date_mesure = Column(DateTime, server_default=func.now())
    profondeur_max = Column(Float, nullable=True)
    gamma_ray = Column(Boolean, default=False)
    diamatreur = Column(Boolean, default=False)
    imagerie = Column(Boolean, default=False)
    trajectometrie = Column(Boolean, default=False)
    endoscope = Column(Boolean, default=False)
    uv = Column(Boolean, default=False)
    camera_axiale = Column(Boolean, default=False)
    date_debut = Column(DateTime, nullable=True)
    date_fin = Column(DateTime, nullable=True)
    equipe = Column(String(255), nullable=True)
    est_actif = Column(Boolean, default=True)
    forage_ref = relationship("Forage", back_populates="diagraphies")

class Media(Base):
    __tablename__ = "media"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    forage = Column(String(100), ForeignKey("forage.forage", ondelete="CASCADE"), nullable=False)
    type_media = Column(String(255), nullable=True)
    chemin_fichier = Column(String(255), nullable=False)
    date_capture = Column(DateTime, server_default=func.now())
    est_actif = Column(Boolean, default=True)
    forage_parent = relationship("Forage", back_populates="medias")