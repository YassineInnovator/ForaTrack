from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

SQLALCHEMY_DATABASE_URL = "postgresql://postgres:ginger_2026@localhost:5432/Fora_db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)

# SessionLocal sera utilisé plus tard pour ouvrir une transaction avec la DB à chaque requête web
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# C'est la classe parente de tous nos futurs modèles
Base = declarative_base()