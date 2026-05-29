import { Banknote, Package, Users, Truck } from 'lucide-react';
import type { OBSubTab } from './types';

export const OB_TABS: { id: OBSubTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'treasury', label: 'الخزائن', icon: Banknote },
  { id: 'products', label: 'المنتجات', icon: Package },
  { id: 'customers', label: 'العملاء', icon: Users },
  { id: 'suppliers', label: 'عملاء (يُشترى منهم)', icon: Truck },
];
