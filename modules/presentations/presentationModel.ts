export interface Slide {
  title: string;
  bullets: string[];
}

export interface PresentationDocument {
  slides: Slide[];
}

export function createBlankPresentation(): PresentationDocument {
  return { slides: [{ title: "Untitled Slide", bullets: [] }] };
}
