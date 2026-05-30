import { Injectable } from '@angular/core';

import {
  Annotation,
  AnnotationCategory,
  AnnotationCategoryPayload,
  AnnotationPayload,
  Category,
  CategoryPayload,
  Citizen,
  CitizenPayload,
  City,
  CityPayload,
  Commune,
  CommunePayload,
  Department,
  DepartmentPayload,
  Entity,
  EntityPayload,
  Evidence,
  EvidencePayload,
  InterestedParty,
  InterestedPartyPayload,
  Neighborhood,
  NeighborhoodPayload,
  Official,
  OfficialPayload,
  Point,
  PointPayload,
  TERRITORIAL_RESOURCES,
  Vote,
  VotePayload
} from '../models/territorial.models';
import { CrudResourceService } from './crud-resource.service';

@Injectable({ providedIn: 'root' })
export class DepartmentCrudService extends CrudResourceService<Department, DepartmentPayload> {
  protected override readonly resourcePath = TERRITORIAL_RESOURCES.departments;
}

@Injectable({ providedIn: 'root' })
export class CityCrudService extends CrudResourceService<City, CityPayload> {
  protected override readonly resourcePath = TERRITORIAL_RESOURCES.cities;
}

@Injectable({ providedIn: 'root' })
export class EntityCrudService extends CrudResourceService<Entity, EntityPayload> {
  protected override readonly resourcePath = TERRITORIAL_RESOURCES.entities;
}

@Injectable({ providedIn: 'root' })
export class OfficialCrudService extends CrudResourceService<Official, OfficialPayload> {
  protected override readonly resourcePath = TERRITORIAL_RESOURCES.officials;
}

@Injectable({ providedIn: 'root' })
export class CitizenCrudService extends CrudResourceService<Citizen, CitizenPayload> {
  protected override readonly resourcePath = TERRITORIAL_RESOURCES.citizens;
}

@Injectable({ providedIn: 'root' })
export class CategoryCrudService extends CrudResourceService<Category, CategoryPayload> {
  protected override readonly resourcePath = TERRITORIAL_RESOURCES.categories;
}

@Injectable({ providedIn: 'root' })
export class CommuneCrudService extends CrudResourceService<Commune, CommunePayload> {
  protected override readonly resourcePath = TERRITORIAL_RESOURCES.communes;
}

@Injectable({ providedIn: 'root' })
export class NeighborhoodCrudService extends CrudResourceService<Neighborhood, NeighborhoodPayload> {
  protected override readonly resourcePath = TERRITORIAL_RESOURCES.neighborhoods;
}

@Injectable({ providedIn: 'root' })
export class PointCrudService extends CrudResourceService<Point, PointPayload> {
  protected override readonly resourcePath = TERRITORIAL_RESOURCES.points;
}

@Injectable({ providedIn: 'root' })
export class AnnotationCrudService extends CrudResourceService<Annotation, AnnotationPayload> {
  protected override readonly resourcePath = TERRITORIAL_RESOURCES.annotations;
}

@Injectable({ providedIn: 'root' })
export class VoteCrudService extends CrudResourceService<Vote, VotePayload> {
  protected override readonly resourcePath = TERRITORIAL_RESOURCES.votes;
}

@Injectable({ providedIn: 'root' })
export class EvidenceCrudService extends CrudResourceService<Evidence, EvidencePayload> {
  protected override readonly resourcePath = TERRITORIAL_RESOURCES.evidences;
}

@Injectable({ providedIn: 'root' })
export class InterestedPartyCrudService extends CrudResourceService<InterestedParty, InterestedPartyPayload> {
  protected override readonly resourcePath = TERRITORIAL_RESOURCES.interestedParties;
}

@Injectable({ providedIn: 'root' })
export class AnnotationCategoryCrudService extends CrudResourceService<AnnotationCategory, AnnotationCategoryPayload> {
  protected override readonly resourcePath = TERRITORIAL_RESOURCES.annotationCategories;
}
