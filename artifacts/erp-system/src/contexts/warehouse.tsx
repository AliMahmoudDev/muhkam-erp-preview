import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getTenantScopedStorageKey } from '@/lib/tenant-storage';

interface WarehouseContextType {
  currentWarehouseId: string;
  setWarehouseId: (id: string) => void;
}

const WarehouseContext = createContext<WarehouseContextType>({
  currentWarehouseId: '',
  setWarehouseId: () => {},
});

const STORAGE_KEY_BASE = 'erp_current_warehouse_id';

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [currentWarehouseId, setCurrentWarehouseId] = useState<string>(() => {
    try {
      return localStorage.getItem(getTenantScopedStorageKey(STORAGE_KEY_BASE)) ?? '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    const reloadWarehouse = () => {
      try {
        setCurrentWarehouseId(
          localStorage.getItem(getTenantScopedStorageKey(STORAGE_KEY_BASE)) ?? ''
        );
      } catch {
        setCurrentWarehouseId('');
      }
    };

    window.addEventListener('auth:user-changed', reloadWarehouse);
    window.addEventListener('storage', reloadWarehouse);
    return () => {
      window.removeEventListener('auth:user-changed', reloadWarehouse);
      window.removeEventListener('storage', reloadWarehouse);
    };
  }, []);

  const setWarehouseId = (id: string) => {
    try {
      localStorage.setItem(getTenantScopedStorageKey(STORAGE_KEY_BASE), id);
    } catch {
      /* silent */
    }
    setCurrentWarehouseId(id);
  };

  return (
    <WarehouseContext.Provider value={{ currentWarehouseId, setWarehouseId }}>
      {children}
    </WarehouseContext.Provider>
  );
}

export function useWarehouse() {
  return useContext(WarehouseContext);
}
