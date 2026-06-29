from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if SQLALCHEMY_DATABASE_URL is None:
    raise ValueError("🚨 ERREUR CRITIQUE : La variable DATABASE_URL est introuvable dans le fichier .env !")
  
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# SessionLocal sera utilisé plus tard pour ouvrir une transaction avec la DB à chaque requête web
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# C'est la classe parente de tous nos futurs modèles
Base = declarative_base()
