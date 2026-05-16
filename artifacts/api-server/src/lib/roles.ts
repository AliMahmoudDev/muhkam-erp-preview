export const Role = {
  SuperAdmin: 'super_admin',
  Admin:      'admin',
  Manager:    'manager',
  Cashier:    'cashier',
  Employee:   'employee',
  Technician: 'technician',
} as const;
export type RoleType = typeof Role[keyof typeof Role];
