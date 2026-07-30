import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Plus, Trash2, Save, CheckCircle2, AlertTriangle, 
  Droplets, History, X, Clock, PlayCircle, ShieldAlert, PauseCircle, Loader2
} from 'lucide-react';

const gingerBleu = "#1D365A";

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch(e) {
    return 'row-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
  }
};

