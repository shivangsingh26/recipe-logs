// Recipe routes. Ids travel in the query string because a static export cannot pre-build
// one page per recipe; routes keep their trailing slash.

export const NEW_RECIPE_HREF = "/recipe/edit/";

export function recipeHref(id: string): string {
  return `/recipe/?id=${encodeURIComponent(id)}`;
}

export function editRecipeHref(id: string): string {
  return `/recipe/edit/?id=${encodeURIComponent(id)}`;
}
