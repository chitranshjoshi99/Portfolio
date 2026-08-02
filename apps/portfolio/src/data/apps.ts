import catalog from "../../../catalog.json";

export type PublishedApp = {
  project: string;
  slug: string;
  name: string;
  label: string;
  description: string;
  accent: string;
};

export const PUBLISHED_APPS = catalog.apps as PublishedApp[];
