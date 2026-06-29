import datetime
import enum
import uuid
from zoneinfo import ZoneInfo
from pg8000 import Date
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Enum, Date, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class RoleUtilisateur(str,enum.Enum):
  TERRAIN = "TERRAIN"
  BUREAU = "BUREAU"
  ADMIN = "ADMIN"
  
class StatutWorkflow(str,enum.Enum):
  BROUILLON = "BROUILLON"
  EN_ATTENTE_VALIDATION = "EN_ATTENTE_VALIDATION"
  VALIDE = "VALIDE"

def obtenir_heure_paris():
    heure_utc = datetime.datetime.utcnow()
    heure_paris = heure_utc + datetime.timedelta(hours=2)
    return heure_paris
  
class LogAction(Base):
  __tablename__ = "logs_action"
  
  # On génère un ID unique pour chaque log
  id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)  
  utilisateur_id = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id", ondelete="SET NULL"), nullable=False)
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
  
class Forage(Base):
  __tablename__ = "forage"
  
  id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
  forage = Column(String(100), nullable=True) 
  campagne = Column(String(100), nullable=True)
  galerie = Column(String(255), nullable=True)
  galerie_proche = Column(String(100), nullable=True)
  pm = Column(Float, nullable=True)
  situation = Column(String(255), nullable=True)
  debut_du_suivi = Column(Date, nullable=True)
  fin_du_suivi = Column(Date, nullable=True)
  longueur = Column(Float, nullable=True)
  distance_ref_par = Column(Float, nullable=True)
  diametre_forage = Column(Float, nullable=True)
  gisement = Column(Float, nullable=True)
  inclinaison = Column(Float, nullable=True)
  numero_rapport = Column(String(255), nullable=True)
  x_tete = Column(Float, nullable=True)
  x_pied = Column(Float, nullable=True)
  y_tete = Column(Float, nullable=True)
  y_pied = Column(Float, nullable=True)
  z_tete = Column(Float, nullable=True)
  z_pied = Column(Float, nullable=True)
  log = Column(Boolean, nullable=True)
    
  statut = Column(Enum(StatutWorkflow), default=StatutWorkflow.BROUILLON)
  galerie_id = Column(UUID(as_uuid=True), ForeignKey("galeries.id")) 
  cree_par = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"))
  date_creation = Column(DateTime, default=datetime.datetime.utcnow)
  est_actif = Column(Boolean, default=True, index=True)

  galerie_liee = relationship("Galeries", back_populates="forages")
  createur = relationship("Utilisateur", back_populates="forages")
  oxydations = relationship("Oxydation", back_populates="forage_lie")
  diagraphies = relationship("Diagraphie", back_populates="forage_ref")
  medias = relationship("Media", back_populates="forage")
    
class Oxydation(Base):
  __tablename__ = "oxydation"
  
  id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
  '''profondeur = Column(Float, nullable=False)
  degre_oxydation = Column(String(50))
  remarques = Column(String)'''
  forage_id = Column(UUID(as_uuid=True), ForeignKey("forage.id", ondelete="CASCADE"), nullable=False)
  
  forage = Column(String(100), nullable=True) # Le nom du forage en texte
  temps_apres_carottage_h = Column(Float, nullable=True)
  temps_apres_creusement_j = Column(Float, nullable=True)
    
  # Dans models.py
  gypse = Column(Float, nullable=True) 
  bioturbations_oxydees = Column(Float, nullable=True)
  patine_oxydation = Column(Float, nullable=True)
  oxydation_masse = Column(Float, nullable=True)
  gypse_sur_debris = Column(Float, nullable=True)
  bioturbations_sur_debris = Column(Float, nullable=True)
  patine_sur_debris = Column(Float, nullable=True)

    
  forage_lie = relationship("Forage", back_populates="oxydations")

class Diagraphie(Base):
  __tablename__ = "diagraphie"
  
  id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
  
  forage_id = Column(UUID(as_uuid=True), ForeignKey("forage.id", ondelete="CASCADE"), nullable=False)
  numero = Column(String(50), nullable=True)
  forage_nom = Column(String(100), nullable=True)
  date_mesure = Column(DateTime, server_default=func.now())
  profondeur_max = Column(Float, nullable=True)
  gamma_ray = Column(Boolean, default=False)
  diametreur = Column(Boolean, default=False)
  imagerie = Column(Boolean, default=False)
  trajectometrie = Column(Boolean, default=False)
  endoscope = Column(Boolean, default=False)
  uv = Column(Boolean, default=False)
  camera_axiale = Column(Boolean, default=False)
  
  forage_ref = relationship("Forage", back_populates="diagraphies")
  

class Media(Base):
  __tablename__ = "media"
  
  id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
  chemin_fichier = Column(String(255), nullable=False)
  description = Column(String)
  forage_id = Column(UUID(as_uuid=True), ForeignKey("forage.id", ondelete="CASCADE"), nullable=False)
  date_capture = Column(DateTime, server_default=func.now())
  
  forage = relationship("Forage", back_populates="medias")
  
  
  
class ForageMapping(Base):
    __tablename__ = "forage_mapping"

    forage_nom = Column(String(100), primary_key=True)
    forage_id = Column(UUID(as_uuid=True), ForeignKey("forage.id", ondelete="CASCADE"), nullable=False)
    
    