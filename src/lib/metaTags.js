/**
 * Update Open Graph meta tags for blueprint sharing
 * This allows proper preview when sharing blueprint links on Discord, Twitter, etc.
 */
export const updateBlueprintMetaTags = (blueprint) => {
  if (!blueprint) {
    resetMetaTags();
    return;
  }

  const baseUrl = window.location.origin;
  const blueprintUrl = `${baseUrl}?blueprintId=${blueprint.id}`;
  const imageUrl = blueprint.image_url || `${baseUrl}/logo.jpg`;

  // Update or create meta tags
  updateMetaTag("og:title", blueprint.title);
  updateMetaTag("og:description", blueprint.description || `Check out this Alchemy Factory blueprint: ${blueprint.title}`);
  updateMetaTag("og:image", imageUrl);
  updateMetaTag("og:url", blueprintUrl);
  updateMetaTag("twitter:title", blueprint.title);
  updateMetaTag("twitter:description", blueprint.description || `Check out this Alchemy Factory blueprint: ${blueprint.title}`);
  updateMetaTag("twitter:image", imageUrl);
  
  // Update page title
  document.title = `${blueprint.title} | Alchemy Factory Blueprints`;
};

export const resetMetaTags = () => {
  const baseUrl = window.location.origin;
  const defaultImage = `${baseUrl}/logo.jpg`;

  updateMetaTag("og:title", "Alchemy Factory Blueprint Hub");
  updateMetaTag("og:description", "Share and download optimized .af factory designs. The community hub for Alchemy Factory players.");
  updateMetaTag("og:image", defaultImage);
  updateMetaTag("og:url", baseUrl);
  updateMetaTag("twitter:title", "Alchemy Factory Blueprint Hub");
  updateMetaTag("twitter:description", "Looking for the best Alchemy Factory layouts? Find and share .af blueprints here.");
  updateMetaTag("twitter:image", defaultImage);
  
  document.title = "Alchemy Factory Blueprints | Share & Download .af Layouts";
};

const updateMetaTag = (property, content) => {
  let element = document.querySelector(`meta[property="${property}"]`);
  
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }
  
  element.setAttribute("content", content);
};
