import Image from "next/image";

const CHARACTER_IMAGES = {
  planning: "/illustrations/characters/planning-azul.png",
  care: "/illustrations/characters/care-azul.png",
  learning: "/illustrations/characters/learning-azul.png",
  ideas: "/illustrations/characters/ideas-azul.png",
  resources: "/illustrations/characters/resources-azul.png",
} as const;

export type CharacterVariant = keyof typeof CHARACTER_IMAGES;

type CharacterProps = {
  variant: CharacterVariant;
  className?: string;
  preload?: boolean;
};

// Decorative companions: nearby headings carry the meaning for assistive technology.
export function Character({ variant, className = "w-32", preload = false }: CharacterProps) {
  return (
    <span aria-hidden="true" className={`pointer-events-none block shrink-0 select-none print:hidden ${className}`}>
      <Image
        src={CHARACTER_IMAGES[variant]}
        alt=""
        width={1254}
        height={1254}
        sizes="(max-width: 640px) 128px, (max-width: 1280px) 180px, 224px"
        preload={preload}
        className="h-auto w-full object-contain"
      />
    </span>
  );
}
