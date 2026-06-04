import enum
from sqlalchemy import Column, String, Float, Integer, ForeignKey, DateTime, Enum as SQLEnum
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
  
class Utilisateur(Base):
  __tablename__ = "utilisateur"
  
  id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
  nom = Column(String(100), nullable=False)
  prenom = Column(String(100), nullable=False)
  email = Column(String(255), unique=True, nullable=False)
  mot_de_passe_h = Column(String(255), nullable=False)
  role = Column(SQLEnum(RoleUtilisateur, name="role_utilisateur"), nullable=False)
  
  forages_crees = relationship("Forage", back_populates="createur")
  
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
  forages = relationship("Forage", back_populates="galerie", cascade="all, delete-orphan")
  
class Forage(Base):
  __tablename__ = "forage"
  
  id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
  nom_forage = Column(String(100), nullable=False, unique=True)
  campagne = Column(String(100))
  galerie_proche = Column(String(100))
  pm = Column(Float)
  situation = Column(String(255))
  statut = Column(SQLEnum(StatutWorkflow, name="statut_workflow"), nullable=False, default=StatutWorkflow.BROUILLON)
  
  galerie_id = Column(UUID(as_uuid=True), ForeignKey("galeries.id", ondelete="CASCADE"), nullable=False)
  cree_par = Column(UUID(as_uuid=True), ForeignKey("utilisateur.id"), nullable=False)
  date_creation = Column(DateTime, server_default=func.now())
  
  galerie = relationship("Galeries", back_populates="forages")
  createur = relationship("Utilisateur", back_populates="forages_crees")
  
  oxydations = relationship("Oxydation", back_populates="forage", cascade="all, delete-orphan")
  diagraphies = relationship("Diagraphie", back_populates="forage", cascade="all, delete-orphan")
  medias = relationship("Media", back_populates="forage", cascade="all, delete-orphan")
  
class Oxydation(Base):
  __tablename__ = "oxydation"
  
  id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
  profondeur = Column(Float, nullable=False)
  degre_oxydation = Column(String(50))
  remarques = Column(String)
  forage_id = Column(UUID(as_uuid=True), ForeignKey("forage.id", ondelete="CASCADE"), nullable=False)
  date_mesure = Column(DateTime, server_default=func.now())
  
  forage = relationship("Forage", back_populates="oxydations")
  
class Diagraphie(Base):
  __tablename__ = "diagraphie"
  
  id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
  profondeur_debut = Column(Float, nullable=False)
  profondeur_fin = Column(Float, nullable=False)
  type_mesure = Column(String(100))
  valeur_mesure = Column(Float)
  forage_id = Column(UUID(as_uuid=True), ForeignKey("forage.id", ondelete="CASCADE"), nullable=False)
  date_mesure = Column(DateTime, server_default=func.now())
  
  forage = relationship("Forage", back_populates="diagraphies")
  
class Media(Base):
  __tablename__ = "media"
  
  id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
  chemin_fichier = Column(String(255), nullable=False)
  description = Column(String)
  forage_id = Column(UUID(as_uuid=True), ForeignKey("forage.id", ondelete="CASCADE"), nullable=False)
  date_capture = Column(DateTime, server_default=func.now())
  
  forage = relationship("Forage", back_populates="medias")
  