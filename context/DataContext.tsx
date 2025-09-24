// context/DataContext.tsx
import React, {
  createContext,
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  useContext,
  useMemo,
  useState,
} from 'react';

export type PieceLine = {
  id: string;
  diameter: string | number; // "1/2", "3/8", 12, etc.
  label: string;             // Zapata, Columna, ...
  minCut: number;            // Corte mínimo por pieza (m)
  qty: number;               // Cantidad (entero)
};

type DataCtx = {
  stockLength: number | null;                                  // 9 o 12 (m)
  setStockLength: Dispatch<SetStateAction<number | null>>;

  diameter: string | number | null;                            // diámetro activo
  setDiameter: Dispatch<SetStateAction<string | number | null>>;

  pieces: PieceLine[];                                         // todas las líneas (todos los diámetros)
  setPieces: Dispatch<SetStateAction<PieceLine[]>>;

  addPiece: (p: PieceLine) => void;
  removePiece: (id: string) => void;
  clearPieces: () => void;
};

const Ctx = createContext<DataCtx | null>(null);

export const DataProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [stockLength, setStockLength] = useState<number | null>(null);
  const [diameter, setDiameter] = useState<string | number | null>(null);
  const [pieces, setPieces] = useState<PieceLine[]>([]);

  const addPiece = (p: PieceLine) => setPieces(prev => [...prev, p]);
  const removePiece = (id: string) => setPieces(prev => prev.filter(x => x.id !== id));
  const clearPieces = () => setPieces([]);

  const value = useMemo(
    () => ({
      stockLength, setStockLength,
      diameter, setDiameter,
      pieces, setPieces,
      addPiece, removePiece, clearPieces,
    }),
    [stockLength, diameter, pieces]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useDataContext = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDataContext must be used within DataProvider');
  return ctx;
};
