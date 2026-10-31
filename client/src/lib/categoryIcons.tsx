import { BookOpen, Dumbbell, Flower2, Gamepad2, Monitor, Package, Tent, UtensilsCrossed, Wrench, type LucideIcon } from 'lucide-react';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'books-study': BookOpen,
  electronics: Monitor,
  'tools-diy': Wrench,
  kitchen: UtensilsCrossed,
  'sports-fitness': Dumbbell,
  'outdoor-camping': Tent,
  'games-entertainment': Gamepad2,
  'home-garden': Flower2,
  other: Package,
};
