export interface CatalogProduct {
  sku: string;
  defaultName: string;
  category: string;
}

export interface CatalogModel {
  id: string;
  label: string;
  products: CatalogProduct[];
}

export interface CatalogBrand {
  id: string;
  label: string;
  models: CatalogModel[];
}

export interface CatalogCategory {
  id: string;
  label: string;
  icon: string;
  brands: CatalogBrand[];
}

function screen(brand: string, model: string, modelCode: string): CatalogProduct[] {
  return [
    { sku: `SCR-${modelCode}-OG`, defaultName: `شاشة ${brand} ${model} — أصلي`, category: 'شاشات وفلاتات' },
    { sku: `SCR-${modelCode}-CPA`, defaultName: `شاشة ${brand} ${model} — كوبي A+`, category: 'شاشات وفلاتات' },
    { sku: `SCR-${modelCode}-CP`, defaultName: `شاشة ${brand} ${model} — كوبي`, category: 'شاشات وفلاتات' },
    { sku: `SCR-${modelCode}-USD`, defaultName: `شاشة ${brand} ${model} — مستعمل`, category: 'شاشات وفلاتات' },
  ];
}

function battery(brand: string, model: string, modelCode: string): CatalogProduct[] {
  return [
    { sku: `BAT-${modelCode}-OG`, defaultName: `بطارية ${brand} ${model} — أصلي`, category: 'بطاريات' },
    { sku: `BAT-${modelCode}-CP`, defaultName: `بطارية ${brand} ${model} — كوبي`, category: 'بطاريات' },
  ];
}

export const MOBILE_CATALOG: CatalogCategory[] = [
  {
    id: 'screens',
    label: 'شاشات وفلاتات',
    icon: '📱',
    brands: [
      {
        id: 'iphone',
        label: 'iPhone',
        models: [
          { id: 'iph12', label: 'iPhone 12', products: screen('iPhone', '12', 'IP12') },
          { id: 'iph12p', label: 'iPhone 12 Pro', products: screen('iPhone', '12 Pro', 'IP12P') },
          { id: 'iph12pm', label: 'iPhone 12 Pro Max', products: screen('iPhone', '12 Pro Max', 'IP12PM') },
          { id: 'iph12m', label: 'iPhone 12 Mini', products: screen('iPhone', '12 Mini', 'IP12M') },
          { id: 'iph13', label: 'iPhone 13', products: screen('iPhone', '13', 'IP13') },
          { id: 'iph13p', label: 'iPhone 13 Pro', products: screen('iPhone', '13 Pro', 'IP13P') },
          { id: 'iph13pm', label: 'iPhone 13 Pro Max', products: screen('iPhone', '13 Pro Max', 'IP13PM') },
          { id: 'iph13m', label: 'iPhone 13 Mini', products: screen('iPhone', '13 Mini', 'IP13M') },
          { id: 'iph14', label: 'iPhone 14', products: screen('iPhone', '14', 'IP14') },
          { id: 'iph14p', label: 'iPhone 14 Plus', products: screen('iPhone', '14 Plus', 'IP14PL') },
          { id: 'iph14pr', label: 'iPhone 14 Pro', products: screen('iPhone', '14 Pro', 'IP14P') },
          { id: 'iph14pm', label: 'iPhone 14 Pro Max', products: screen('iPhone', '14 Pro Max', 'IP14PM') },
          { id: 'iph15', label: 'iPhone 15', products: screen('iPhone', '15', 'IP15') },
          { id: 'iph15p', label: 'iPhone 15 Plus', products: screen('iPhone', '15 Plus', 'IP15PL') },
          { id: 'iph15pr', label: 'iPhone 15 Pro', products: screen('iPhone', '15 Pro', 'IP15P') },
          { id: 'iph15pm', label: 'iPhone 15 Pro Max', products: screen('iPhone', '15 Pro Max', 'IP15PM') },
          { id: 'iph16', label: 'iPhone 16', products: screen('iPhone', '16', 'IP16') },
          { id: 'iph16p', label: 'iPhone 16 Plus', products: screen('iPhone', '16 Plus', 'IP16PL') },
          { id: 'iph16pr', label: 'iPhone 16 Pro', products: screen('iPhone', '16 Pro', 'IP16P') },
          { id: 'iph16pm', label: 'iPhone 16 Pro Max', products: screen('iPhone', '16 Pro Max', 'IP16PM') },
        ],
      },
      {
        id: 'samsung',
        label: 'Samsung',
        models: [
          { id: 'sa51', label: 'Galaxy A51', products: screen('Samsung', 'A51', 'SA51') },
          { id: 'sa52', label: 'Galaxy A52', products: screen('Samsung', 'A52', 'SA52') },
          { id: 'sa52s', label: 'Galaxy A52s', products: screen('Samsung', 'A52s', 'SA52S') },
          { id: 'sa53', label: 'Galaxy A53', products: screen('Samsung', 'A53', 'SA53') },
          { id: 'sa54', label: 'Galaxy A54', products: screen('Samsung', 'A54', 'SA54') },
          { id: 'sa71', label: 'Galaxy A71', products: screen('Samsung', 'A71', 'SA71') },
          { id: 'sa72', label: 'Galaxy A72', products: screen('Samsung', 'A72', 'SA72') },
          { id: 'sa73', label: 'Galaxy A73', products: screen('Samsung', 'A73', 'SA73') },
          { id: 'ss21', label: 'Galaxy S21', products: screen('Samsung', 'S21', 'SS21') },
          { id: 'ss21p', label: 'Galaxy S21+', products: screen('Samsung', 'S21+', 'SS21P') },
          { id: 'ss21u', label: 'Galaxy S21 Ultra', products: screen('Samsung', 'S21 Ultra', 'SS21U') },
          { id: 'ss22', label: 'Galaxy S22', products: screen('Samsung', 'S22', 'SS22') },
          { id: 'ss22p', label: 'Galaxy S22+', products: screen('Samsung', 'S22+', 'SS22P') },
          { id: 'ss22u', label: 'Galaxy S22 Ultra', products: screen('Samsung', 'S22 Ultra', 'SS22U') },
          { id: 'ss23', label: 'Galaxy S23', products: screen('Samsung', 'S23', 'SS23') },
          { id: 'ss23u', label: 'Galaxy S23 Ultra', products: screen('Samsung', 'S23 Ultra', 'SS23U') },
          { id: 'ss24', label: 'Galaxy S24', products: screen('Samsung', 'S24', 'SS24') },
          { id: 'ss24u', label: 'Galaxy S24 Ultra', products: screen('Samsung', 'S24 Ultra', 'SS24U') },
        ],
      },
      {
        id: 'xiaomi',
        label: 'Xiaomi',
        models: [
          { id: 'xred10', label: 'Redmi Note 10', products: screen('Xiaomi', 'Redmi Note 10', 'XRN10') },
          { id: 'xred11', label: 'Redmi Note 11', products: screen('Xiaomi', 'Redmi Note 11', 'XRN11') },
          { id: 'xred12', label: 'Redmi Note 12', products: screen('Xiaomi', 'Redmi Note 12', 'XRN12') },
          { id: 'xred13', label: 'Redmi Note 13', products: screen('Xiaomi', 'Redmi Note 13', 'XRN13') },
          { id: 'xmi12', label: 'Xiaomi 12', products: screen('Xiaomi', '12', 'XM12') },
          { id: 'xmi13', label: 'Xiaomi 13', products: screen('Xiaomi', '13', 'XM13') },
          { id: 'xmi14', label: 'Xiaomi 14', products: screen('Xiaomi', '14', 'XM14') },
        ],
      },
      {
        id: 'oppo',
        label: 'Oppo',
        models: [
          { id: 'opa54', label: 'Oppo A54', products: screen('Oppo', 'A54', 'OA54') },
          { id: 'opa74', label: 'Oppo A74', products: screen('Oppo', 'A74', 'OA74') },
          { id: 'opa94', label: 'Oppo A94', products: screen('Oppo', 'A94', 'OA94') },
          { id: 'opr5', label: 'Oppo Reno 5', products: screen('Oppo', 'Reno 5', 'OR5') },
          { id: 'opr6', label: 'Oppo Reno 6', products: screen('Oppo', 'Reno 6', 'OR6') },
          { id: 'opr8', label: 'Oppo Reno 8', products: screen('Oppo', 'Reno 8', 'OR8') },
          { id: 'opr10', label: 'Oppo Reno 10', products: screen('Oppo', 'Reno 10', 'OR10') },
        ],
      },
      {
        id: 'vivo',
        label: 'Vivo',
        models: [
          { id: 'vvy12', label: 'Vivo Y12', products: screen('Vivo', 'Y12', 'VY12') },
          { id: 'vvy20', label: 'Vivo Y20', products: screen('Vivo', 'Y20', 'VY20') },
          { id: 'vvy21', label: 'Vivo Y21', products: screen('Vivo', 'Y21', 'VY21') },
          { id: 'vvy33', label: 'Vivo Y33', products: screen('Vivo', 'Y33', 'VY33') },
          { id: 'vvy35', label: 'Vivo Y35', products: screen('Vivo', 'Y35', 'VY35') },
          { id: 'vvy36', label: 'Vivo Y36', products: screen('Vivo', 'Y36', 'VY36') },
          { id: 'vvv27', label: 'Vivo V27', products: screen('Vivo', 'V27', 'VV27') },
          { id: 'vvv29', label: 'Vivo V29', products: screen('Vivo', 'V29', 'VV29') },
        ],
      },
    ],
  },
  {
    id: 'batteries',
    label: 'بطاريات',
    icon: '🔋',
    brands: [
      {
        id: 'iphone',
        label: 'iPhone',
        models: [
          { id: 'biph12', label: 'iPhone 12', products: battery('iPhone', '12', 'IP12') },
          { id: 'biph12m', label: 'iPhone 12 Mini', products: battery('iPhone', '12 Mini', 'IP12M') },
          { id: 'biph13', label: 'iPhone 13', products: battery('iPhone', '13', 'IP13') },
          { id: 'biph13m', label: 'iPhone 13 Mini', products: battery('iPhone', '13 Mini', 'IP13M') },
          { id: 'biph14', label: 'iPhone 14', products: battery('iPhone', '14', 'IP14') },
          { id: 'biph14p', label: 'iPhone 14 Plus', products: battery('iPhone', '14 Plus', 'IP14PL') },
          { id: 'biph15', label: 'iPhone 15', products: battery('iPhone', '15', 'IP15') },
          { id: 'biph15p', label: 'iPhone 15 Plus', products: battery('iPhone', '15 Plus', 'IP15PL') },
          { id: 'biph16', label: 'iPhone 16', products: battery('iPhone', '16', 'IP16') },
        ],
      },
      {
        id: 'samsung',
        label: 'Samsung',
        models: [
          { id: 'bsa51', label: 'Galaxy A51', products: battery('Samsung', 'A51', 'SA51') },
          { id: 'bsa52', label: 'Galaxy A52', products: battery('Samsung', 'A52', 'SA52') },
          { id: 'bsa53', label: 'Galaxy A53', products: battery('Samsung', 'A53', 'SA53') },
          { id: 'bsa54', label: 'Galaxy A54', products: battery('Samsung', 'A54', 'SA54') },
          { id: 'bsa71', label: 'Galaxy A71', products: battery('Samsung', 'A71', 'SA71') },
          { id: 'bss21', label: 'Galaxy S21', products: battery('Samsung', 'S21', 'SS21') },
          { id: 'bss22', label: 'Galaxy S22', products: battery('Samsung', 'S22', 'SS22') },
          { id: 'bss23', label: 'Galaxy S23', products: battery('Samsung', 'S23', 'SS23') },
          { id: 'bss24', label: 'Galaxy S24', products: battery('Samsung', 'S24', 'SS24') },
        ],
      },
      {
        id: 'xiaomi',
        label: 'Xiaomi',
        models: [
          { id: 'bxrn10', label: 'Redmi Note 10', products: battery('Xiaomi', 'Redmi Note 10', 'XRN10') },
          { id: 'bxrn11', label: 'Redmi Note 11', products: battery('Xiaomi', 'Redmi Note 11', 'XRN11') },
          { id: 'bxrn12', label: 'Redmi Note 12', products: battery('Xiaomi', 'Redmi Note 12', 'XRN12') },
          { id: 'bxrn13', label: 'Redmi Note 13', products: battery('Xiaomi', 'Redmi Note 13', 'XRN13') },
        ],
      },
      {
        id: 'oppo',
        label: 'Oppo',
        models: [
          { id: 'bor5', label: 'Reno 5', products: battery('Oppo', 'Reno 5', 'OR5') },
          { id: 'bor6', label: 'Reno 6', products: battery('Oppo', 'Reno 6', 'OR6') },
          { id: 'bor8', label: 'Reno 8', products: battery('Oppo', 'Reno 8', 'OR8') },
        ],
      },
      {
        id: 'vivo',
        label: 'Vivo',
        models: [
          { id: 'bvy20', label: 'Y20', products: battery('Vivo', 'Y20', 'VY20') },
          { id: 'bvy21', label: 'Y21', products: battery('Vivo', 'Y21', 'VY21') },
          { id: 'bvy33', label: 'Y33', products: battery('Vivo', 'Y33', 'VY33') },
          { id: 'bvy35', label: 'Y35', products: battery('Vivo', 'Y35', 'VY35') },
        ],
      },
    ],
  },
  {
    id: 'cables',
    label: 'كابلات وشواحن',
    icon: '🔌',
    brands: [
      {
        id: 'cables',
        label: 'كابلات',
        models: [
          {
            id: 'cable-typec',
            label: 'كابل Type-C',
            products: [
              { sku: 'CAB-TYPEC-OG', defaultName: 'كابل Type-C — أصلي', category: 'كابلات وشواحن' },
              { sku: 'CAB-TYPEC-CP', defaultName: 'كابل Type-C — كوبي', category: 'كابلات وشواحن' },
            ],
          },
          {
            id: 'cable-lightning',
            label: 'كابل Lightning',
            products: [
              { sku: 'CAB-LGTN-OG', defaultName: 'كابل Lightning — أصلي', category: 'كابلات وشواحن' },
              { sku: 'CAB-LGTN-CP', defaultName: 'كابل Lightning — كوبي', category: 'كابلات وشواحن' },
            ],
          },
          {
            id: 'cable-microusb',
            label: 'كابل Micro-USB',
            products: [
              { sku: 'CAB-MICRO-OG', defaultName: 'كابل Micro-USB — أصلي', category: 'كابلات وشواحن' },
              { sku: 'CAB-MICRO-CP', defaultName: 'كابل Micro-USB — كوبي', category: 'كابلات وشواحن' },
            ],
          },
        ],
      },
      {
        id: 'chargers',
        label: 'شواحن',
        models: [
          {
            id: 'chr-20w',
            label: 'شاحن 20W',
            products: [
              { sku: 'CHR-20W-OG', defaultName: 'شاحن 20W — أصلي', category: 'كابلات وشواحن' },
              { sku: 'CHR-20W-CP', defaultName: 'شاحن 20W — كوبي', category: 'كابلات وشواحن' },
            ],
          },
          {
            id: 'chr-65w',
            label: 'شاحن 65W',
            products: [
              { sku: 'CHR-65W-OG', defaultName: 'شاحن 65W — أصلي', category: 'كابلات وشواحن' },
              { sku: 'CHR-65W-CP', defaultName: 'شاحن 65W — كوبي', category: 'كابلات وشواحن' },
            ],
          },
          {
            id: 'chr-120w',
            label: 'شاحن 120W',
            products: [
              { sku: 'CHR-120W-OG', defaultName: 'شاحن 120W — أصلي', category: 'كابلات وشواحن' },
              { sku: 'CHR-120W-CP', defaultName: 'شاحن 120W — كوبي', category: 'كابلات وشواحن' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'accessories',
    label: 'اكسسوارات',
    icon: '🛡️',
    brands: [
      {
        id: 'cases',
        label: 'كفرات',
        models: [
          {
            id: 'case-silicone',
            label: 'كفر سيليكون',
            products: [
              { sku: 'ACC-SIL-IP', defaultName: 'كفر سيليكون iPhone', category: 'اكسسوارات' },
              { sku: 'ACC-SIL-SA', defaultName: 'كفر سيليكون Samsung', category: 'اكسسوارات' },
              { sku: 'ACC-SIL-GN', defaultName: 'كفر سيليكون عام', category: 'اكسسوارات' },
            ],
          },
          {
            id: 'case-clear',
            label: 'كفر شفاف',
            products: [
              { sku: 'ACC-CLR-IP', defaultName: 'كفر شفاف iPhone', category: 'اكسسوارات' },
              { sku: 'ACC-CLR-SA', defaultName: 'كفر شفاف Samsung', category: 'اكسسوارات' },
              { sku: 'ACC-CLR-GN', defaultName: 'كفر شفاف عام', category: 'اكسسوارات' },
            ],
          },
          {
            id: 'case-magnet',
            label: 'كفر ماغنيت',
            products: [
              { sku: 'ACC-MAG-IP', defaultName: 'كفر ماغنيت iPhone', category: 'اكسسوارات' },
              { sku: 'ACC-MAG-SA', defaultName: 'كفر ماغنيت Samsung', category: 'اكسسوارات' },
            ],
          },
        ],
      },
      {
        id: 'glass',
        label: 'زجاج حماية',
        models: [
          {
            id: 'glass-normal',
            label: 'زجاج عادي',
            products: [
              { sku: 'GLS-NRM-IP', defaultName: 'زجاج حماية عادي iPhone', category: 'اكسسوارات' },
              { sku: 'GLS-NRM-SA', defaultName: 'زجاج حماية عادي Samsung', category: 'اكسسوارات' },
              { sku: 'GLS-NRM-GN', defaultName: 'زجاج حماية عادي عام', category: 'اكسسوارات' },
            ],
          },
          {
            id: 'glass-privacy',
            label: 'زجاج بيرسي (خصوصية)',
            products: [
              { sku: 'GLS-PRV-IP', defaultName: 'زجاج بيرسي iPhone', category: 'اكسسوارات' },
              { sku: 'GLS-PRV-SA', defaultName: 'زجاج بيرسي Samsung', category: 'اكسسوارات' },
              { sku: 'GLS-PRV-GN', defaultName: 'زجاج بيرسي عام', category: 'اكسسوارات' },
            ],
          },
          {
            id: 'glass-full',
            label: 'زجاج كامل',
            products: [
              { sku: 'GLS-FUL-IP', defaultName: 'زجاج كامل iPhone', category: 'اكسسوارات' },
              { sku: 'GLS-FUL-SA', defaultName: 'زجاج كامل Samsung', category: 'اكسسوارات' },
              { sku: 'GLS-FUL-GN', defaultName: 'زجاج كامل عام', category: 'اكسسوارات' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'earphones',
    label: 'سماعات وإيربودز',
    icon: '🎧',
    brands: [
      {
        id: 'wired',
        label: 'سلكية',
        models: [
          {
            id: 'ear-wire-typec',
            label: 'سماعة Type-C',
            products: [
              { sku: 'EAR-WTPC-OG', defaultName: 'سماعة سلكية Type-C — أصلي', category: 'سماعات وإيربودز' },
              { sku: 'EAR-WTPC-CP', defaultName: 'سماعة سلكية Type-C — كوبي', category: 'سماعات وإيربودز' },
            ],
          },
          {
            id: 'ear-wire-lightning',
            label: 'سماعة Lightning',
            products: [
              { sku: 'EAR-WLGN-OG', defaultName: 'سماعة سلكية Lightning — أصلي', category: 'سماعات وإيربودز' },
              { sku: 'EAR-WLGN-CP', defaultName: 'سماعة سلكية Lightning — كوبي', category: 'سماعات وإيربودز' },
            ],
          },
          {
            id: 'ear-wire-35mm',
            label: 'سماعة 3.5mm',
            products: [
              { sku: 'EAR-W35-OG', defaultName: 'سماعة 3.5mm — أصلي', category: 'سماعات وإيربودز' },
              { sku: 'EAR-W35-CP', defaultName: 'سماعة 3.5mm — كوبي', category: 'سماعات وإيربودز' },
            ],
          },
        ],
      },
      {
        id: 'wireless',
        label: 'لاسلكية (إيربودز)',
        models: [
          {
            id: 'ear-airpods2',
            label: 'AirPods 2',
            products: [
              { sku: 'EAR-AP2-OG', defaultName: 'AirPods 2 — أصلي', category: 'سماعات وإيربودز' },
              { sku: 'EAR-AP2-CPA', defaultName: 'AirPods 2 — كوبي A+', category: 'سماعات وإيربودز' },
              { sku: 'EAR-AP2-CP', defaultName: 'AirPods 2 — كوبي', category: 'سماعات وإيربودز' },
            ],
          },
          {
            id: 'ear-airpods3',
            label: 'AirPods 3',
            products: [
              { sku: 'EAR-AP3-OG', defaultName: 'AirPods 3 — أصلي', category: 'سماعات وإيربودز' },
              { sku: 'EAR-AP3-CPA', defaultName: 'AirPods 3 — كوبي A+', category: 'سماعات وإيربودز' },
              { sku: 'EAR-AP3-CP', defaultName: 'AirPods 3 — كوبي', category: 'سماعات وإيربودز' },
            ],
          },
          {
            id: 'ear-airpodspro',
            label: 'AirPods Pro',
            products: [
              { sku: 'EAR-APP-OG', defaultName: 'AirPods Pro — أصلي', category: 'سماعات وإيربودز' },
              { sku: 'EAR-APP-CPA', defaultName: 'AirPods Pro — كوبي A+', category: 'سماعات وإيربودز' },
              { sku: 'EAR-APP-CP', defaultName: 'AirPods Pro — كوبي', category: 'سماعات وإيربودز' },
            ],
          },
          {
            id: 'ear-buds-generic',
            label: 'إيربودز عامة',
            products: [
              { sku: 'EAR-BUD-CPA', defaultName: 'إيربودز لاسلكية — كوبي A+', category: 'سماعات وإيربودز' },
              { sku: 'EAR-BUD-CP', defaultName: 'إيربودز لاسلكية — كوبي', category: 'سماعات وإيربودز' },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'internal',
    label: 'قطع داخلية',
    icon: '🔧',
    brands: [
      {
        id: 'iphone-int',
        label: 'iPhone',
        models: [
          {
            id: 'int-iph-charging',
            label: 'بطاقات الشحن',
            products: [
              { sku: 'INT-CHG-IP12', defaultName: 'بطاقة شحن iPhone 12', category: 'قطع داخلية' },
              { sku: 'INT-CHG-IP13', defaultName: 'بطاقة شحن iPhone 13', category: 'قطع داخلية' },
              { sku: 'INT-CHG-IP14', defaultName: 'بطاقة شحن iPhone 14', category: 'قطع داخلية' },
              { sku: 'INT-CHG-IP15', defaultName: 'بطاقة شحن iPhone 15', category: 'قطع داخلية' },
            ],
          },
          {
            id: 'int-iph-speaker',
            label: 'مكبرات الصوت',
            products: [
              { sku: 'INT-SPK-IP12', defaultName: 'سماعة داخلية iPhone 12', category: 'قطع داخلية' },
              { sku: 'INT-SPK-IP13', defaultName: 'سماعة داخلية iPhone 13', category: 'قطع داخلية' },
              { sku: 'INT-SPK-IP14', defaultName: 'سماعة داخلية iPhone 14', category: 'قطع داخلية' },
              { sku: 'INT-SPK-IP15', defaultName: 'سماعة داخلية iPhone 15', category: 'قطع داخلية' },
            ],
          },
          {
            id: 'int-iph-mic',
            label: 'مايكروفونات',
            products: [
              { sku: 'INT-MIC-IP12', defaultName: 'مايكروفون iPhone 12', category: 'قطع داخلية' },
              { sku: 'INT-MIC-IP13', defaultName: 'مايكروفون iPhone 13', category: 'قطع داخلية' },
              { sku: 'INT-MIC-IP14', defaultName: 'مايكروفون iPhone 14', category: 'قطع داخلية' },
              { sku: 'INT-MIC-IP15', defaultName: 'مايكروفون iPhone 15', category: 'قطع داخلية' },
            ],
          },
          {
            id: 'int-iph-filter',
            label: 'فلاتات',
            products: [
              { sku: 'INT-FLT-IP-EAR', defaultName: 'فلتر سماعة أذن iPhone', category: 'قطع داخلية' },
              { sku: 'INT-FLT-IP-MIC', defaultName: 'فلتر مايك iPhone', category: 'قطع داخلية' },
              { sku: 'INT-FLT-IP-USB', defaultName: 'فلتر منفذ شحن iPhone', category: 'قطع داخلية' },
            ],
          },
        ],
      },
      {
        id: 'samsung-int',
        label: 'Samsung',
        models: [
          {
            id: 'int-sa-charging',
            label: 'بطاقات الشحن',
            products: [
              { sku: 'INT-CHG-SA51', defaultName: 'بطاقة شحن Samsung A51', category: 'قطع داخلية' },
              { sku: 'INT-CHG-SA52', defaultName: 'بطاقة شحن Samsung A52', category: 'قطع داخلية' },
              { sku: 'INT-CHG-SA53', defaultName: 'بطاقة شحن Samsung A53', category: 'قطع داخلية' },
              { sku: 'INT-CHG-SA54', defaultName: 'بطاقة شحن Samsung A54', category: 'قطع داخلية' },
            ],
          },
          {
            id: 'int-sa-speaker',
            label: 'مكبرات الصوت',
            products: [
              { sku: 'INT-SPK-SA51', defaultName: 'سماعة داخلية Samsung A51', category: 'قطع داخلية' },
              { sku: 'INT-SPK-SA52', defaultName: 'سماعة داخلية Samsung A52', category: 'قطع داخلية' },
              { sku: 'INT-SPK-SA53', defaultName: 'سماعة داخلية Samsung A53', category: 'قطع داخلية' },
              { sku: 'INT-SPK-SA54', defaultName: 'سماعة داخلية Samsung A54', category: 'قطع داخلية' },
            ],
          },
          {
            id: 'int-sa-mic',
            label: 'مايكروفونات',
            products: [
              { sku: 'INT-MIC-SA52', defaultName: 'مايكروفون Samsung A52', category: 'قطع داخلية' },
              { sku: 'INT-MIC-SA53', defaultName: 'مايكروفون Samsung A53', category: 'قطع داخلية' },
              { sku: 'INT-MIC-SA54', defaultName: 'مايكروفون Samsung A54', category: 'قطع داخلية' },
            ],
          },
          {
            id: 'int-sa-filter',
            label: 'فلاتات',
            products: [
              { sku: 'INT-FLT-SA-EAR', defaultName: 'فلتر سماعة أذن Samsung', category: 'قطع داخلية' },
              { sku: 'INT-FLT-SA-MIC', defaultName: 'فلتر مايك Samsung', category: 'قطع داخلية' },
              { sku: 'INT-FLT-SA-USB', defaultName: 'فلتر منفذ شحن Samsung', category: 'قطع داخلية' },
            ],
          },
        ],
      },
    ],
  },
];
