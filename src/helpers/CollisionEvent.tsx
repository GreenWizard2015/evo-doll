import { Mesh } from 'three';

export interface ContactInfo {
  bi: Mesh;
  bj: Mesh;
  contactNormal: number[];
  contactPoint: number[];
  id: number;
  impactVelocity?: number;
  distance?: number;
}

export interface CollisionFilters {
  bodyFilterGroup: number;
  bodyFilterMask: number;
  targetFilterGroup: number;
  targetFilterMask: number;
}

export interface CollisionEvent {
  body: Mesh;
  contact: ContactInfo;
  target: Mesh;
  collisionFilters: CollisionFilters;
  op: string;
  type: string;
}
