import { BarChart3, CalendarDays, CircleHelp, ClipboardList, FolderCheck, Heart, Home, Layers, Library, Route, School, Shapes, Sparkles, Stethoscope, UserCog, Users, type LucideIcon } from "lucide-react";
import type { NavigationItem } from "@/lib/navigation";

export const NAV_ICONS: Record<NavigationItem["icon"], LucideIcon> = { home: Home, students: Users, planning: Layers, journey: Route, assistant: Sparkles, resources: Library, calendar: CalendarDays, network: BarChart3, schools: School, accounts: UserCog, family: Heart, care: Stethoscope, help: CircleHelp, evidence: FolderCheck, census: ClipboardList, games: Shapes };
