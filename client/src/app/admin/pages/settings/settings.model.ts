export interface SiteSettings {
  name: string;
  logo: string;
  favicon: string;
  description: string;
}

export interface ContactSettings {
  email: string;
  phone: string;
  address: string;
}

export interface StoreSettings {
  isOpen: boolean;
}

export interface CheckoutSettings {
  allowOrder: boolean;
}

export interface ShippingSettings {
  enabled: boolean;
}

export interface MaintenanceSettings {
  enabled: boolean;
  message: string;
}

export interface SystemSettings {
  language: string;
  currency: string;
  timezone: string;
}

export interface AppSettings {
  _id?: string;
  site: SiteSettings;
  contact: ContactSettings;
  store: StoreSettings;
  checkout: CheckoutSettings;
  shipping: ShippingSettings;
  maintenance: MaintenanceSettings;
  system: SystemSettings;
  updatedAt?: string;
}

export interface SettingsApiResponse {
  success: boolean;
  message?: string;
  data: AppSettings;
}
