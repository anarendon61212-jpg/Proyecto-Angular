export type IsoDateString = string;
export type TerritorialStatus = 'Activa' | 'Activo' | 'Inactiva' | 'Inactivo' | 'active' | 'inactive' | string;

export interface Department {
  id_department: number;
  name: string;
  dane_code?: string | null;
}

export interface City {
  id_city: number;
  id_department: number;
  name: string;
  dane_code?: string | null;
}

export interface Entity {
  id_entity: number;
  name: string;
  nit?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logo_url?: string | null;
  status: TerritorialStatus;
}

export interface Official {
  id_official: number;
  id_entity: number;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  status: TerritorialStatus;
  last_latitude?: number | null;
  last_longitude?: number | null;
  last_gps_update?: IsoDateString | null;
  gps_active: boolean;
}

export interface OfficialCreatePayload {
  id_entity: number;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  status: TerritorialStatus;
  last_latitude?: number | null;
  last_longitude?: number | null;
  last_gps_update?: IsoDateString | null;
  gps_active?: boolean;
}

export interface OfficialTracking {
  id_official: number;
  id_entity?: number | null;
  latitude: number;
  longitude: number;
  last_gps_update?: IsoDateString | null;
  lastUpdate?: IsoDateString | null;
  gps_active?: boolean;
}

export interface TrackingPayload {
  officials: OfficialTracking[];
}

export interface Citizen {
  id_citizen: number;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: TerritorialStatus;
}

export interface Category {
  id_category: number;
  id_parent_category?: number | null;
  name: string;
  description?: string | null;
  image_url?: string | null;
  status: TerritorialStatus;
}

export interface Commune {
  id_commune: number;
  id_city: number;
  name: string;
  status: TerritorialStatus;
  created_at?: IsoDateString | null;
  updated_at?: IsoDateString | null;
}

export interface Neighborhood {
  id_neighborhood: number;
  id_commune: number;
  name: string;
  commune_name?: string | null;
  status: TerritorialStatus;
  created_at?: IsoDateString | null;
  updated_at?: IsoDateString | null;
}

export type PointType = 'polygon' | 'annotation' | 'boundary' | string;

export interface Point {
  id_point: number;
  id_neighborhood?: number | null;
  id_annotation?: number | null;
  latitude: number;
  longitude: number;
  order?: number | null;
  point_type: PointType;
}

export interface Annotation {
  id_annotation: number;
  id_neighborhood?: number | null;
  id_citizen: number;
  description: string;
  latitude: number;
  longitude: number;
  status: TerritorialStatus;
  registration_date?: IsoDateString | null;
}

export interface Vote {
  id_vote: number;
  id_citizen: number;
  id_annotation: number;
  stars: number;
  comment?: string | null;
  vote_date?: IsoDateString | null;
}

export interface Evidence {
  id_evidence: number;
  id_annotation: number;
  file_url: string;
  file_type: string;
  file_size?: number | null;
  upload_date?: IsoDateString | null;
}

export interface InterestedParty {
  id_interested_party: number;
  id_entity: number;
  id_annotation: number;
  association_date?: IsoDateString | null;
}

export interface AnnotationCategory {
  id_annotation_category: number;
  id_category: number;
  id_annotation: number;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface AnnotationDetail extends Annotation {
  citizen?: Citizen;
  neighborhood?: Neighborhood;
  categories?: Category[];
  evidences?: Evidence[];
  interested_parties?: InterestedParty[];
  average_rating?: number;
  votes_count?: number;
}

export type DepartmentPayload = Omit<Department, 'id_department'>;
export type CityPayload = Omit<City, 'id_city'>;
export type EntityPayload = Omit<Entity, 'id_entity'>;
export type OfficialPayload = Omit<Official, 'id_official'>;
export type CitizenPayload = Omit<Citizen, 'id_citizen'>;
export type CategoryPayload = Omit<Category, 'id_category'>;
export type CommunePayload = Omit<Commune, 'id_commune' | 'created_at' | 'updated_at'>;
export type NeighborhoodPayload = Omit<Neighborhood, 'id_neighborhood' | 'created_at' | 'updated_at'>;
export type PointPayload = Omit<Point, 'id_point'>;
export type AnnotationPayload = Omit<Annotation, 'id_annotation' | 'registration_date'>;
export type VotePayload = Omit<Vote, 'id_vote' | 'vote_date'>;
export type EvidencePayload = Omit<Evidence, 'id_evidence' | 'upload_date'>;
export type InterestedPartyPayload = Omit<InterestedParty, 'id_interested_party' | 'association_date'>;
export type AnnotationCategoryPayload = Omit<AnnotationCategory, 'id_annotation_category'>;

export interface ReportSummary {
  label: string;
  value: number;
  group?: 'category' | 'status' | string;
}

export interface ReportHistoryEntry {
  id_report: number;
  title: string;
  summary: string;
  type: string;
  created_at: IsoDateString;
}

export interface ReportChatMessage {
  role: 'user' | 'assistant';
  message: string;
  timestamp?: IsoDateString;
}

export interface ReportChatRequest {
  prompt: string;
}

export interface ReportChatResponse {
  reply: string;
}

export const TERRITORIAL_RESOURCES = {
  departments: 'departments',
  cities: 'cities',
  entities: 'entities',
  officials: 'officials',
  citizens: 'citizens',
  categories: 'categories',
  communes: 'communes',
  neighborhoods: 'neighborhoods',
  points: 'points',
  annotations: 'annotations',
  votes: 'votes',
  evidences: 'evidences',
  interestedParties: 'interested-parties',
  annotationCategories: 'annotation-categories',
  reports: 'reports'
} as const;

export type TerritorialResourcePath = (typeof TERRITORIAL_RESOURCES)[keyof typeof TERRITORIAL_RESOURCES]