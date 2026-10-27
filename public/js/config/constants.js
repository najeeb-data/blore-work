// Domain constants shared across pages and services.
// The first five categories appear in the footer, per the nav spec.

export const CATEGORIES = [
  { id: 'event-staff',       label: 'Event Staff' },
  { id: 'hotel-restaurant',  label: 'Hotel & Restaurant' },
  { id: 'catering',          label: 'Catering' },
  { id: 'housekeeping',      label: 'Housekeeping' },
  { id: 'delivery',          label: 'Delivery & Logistics' },
  { id: 'kitchen-help',      label: 'Kitchen Help' },
  { id: 'promoters',         label: 'Promoters' },
  { id: 'security',          label: 'Security Staff' },
];

export const CITIES = [
  { id: 'bangalore', label: 'Bangalore', active: true },
];

export const PRIMARY_CITY = 'bangalore';

// Hero quick-filter chips. Order is intentional.
export const QUICK_FILTERS = [
  { id: 'today',    label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend',  label: 'This Weekend' },
  { id: 'nearby',   label: 'Nearby Jobs' },
];
