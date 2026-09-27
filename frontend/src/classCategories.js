export const CLASS_CATEGORIES = [
  { id: "studio", label: "Studio offline" },
  { id: "online", label: "Online" },
  { id: "home", label: "Home visit" },
];

export function classCategories(c) {
  return c.categories?.length ? c.categories : ["studio", "online"];
}
