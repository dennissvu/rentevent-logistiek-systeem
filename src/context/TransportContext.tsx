import { createContext, useContext, ReactNode } from 'react';
import { TransportMaterial, CombiTransport } from '@/data/transportData';
import { Driver } from '@/data/planningData';
import { useTransportDb } from '@/hooks/useTransportDb';
import { useDriversDb } from '@/hooks/useDriversDb';

interface TransportContextType {
  // Transport materials
  bakwagens: TransportMaterial[];
  aanhangers: TransportMaterial[];
  combis: CombiTransport[];
  allTransportMaterials: TransportMaterial[];
  
  // Drivers
  drivers: Driver[];
  
  // Loading state
  isLoading: boolean;
  
  // Mutations
  addMaterial: (material: Omit<TransportMaterial, 'id'> & { code: string }) => void;
  updateMaterial: (code: string, updates: Partial<TransportMaterial>) => void;
  deleteMaterial: (code: string) => void;
  addDriver: (driver: Omit<Driver, 'id'>) => void;
  updateDriver: (id: string, updates: Partial<Driver>) => void;
  deleteDriver: (id: string) => void;
}

const TransportContext = createContext<TransportContextType | undefined>(undefined);

export function TransportProvider({ children }: { children: ReactNode }) {
  const {
    bakwagens,
    aanhangers,
    combis,
    allMaterials,
    isLoading: isLoadingTransport,
    addMaterial,
    updateMaterial,
    deleteMaterial,
  } = useTransportDb();

  const {
    drivers,
    isLoading: isLoadingDrivers,
    addDriver,
    updateDriver,
    deleteDriver,
  } = useDriversDb();

  return (
    <TransportContext.Provider
      value={{
        bakwagens,
        aanhangers,
        combis,
        allTransportMaterials: allMaterials,
        drivers,
        isLoading: isLoadingTransport || isLoadingDrivers,
        addMaterial,
        updateMaterial,
        deleteMaterial,
        addDriver,
        updateDriver,
        deleteDriver,
      }}
    >
      {children}
    </TransportContext.Provider>
  );
}

export function useTransport() {
  const context = useContext(TransportContext);
  if (context === undefined) {
    throw new Error('useTransport must be used within a TransportProvider');
  }
  return context;
}
