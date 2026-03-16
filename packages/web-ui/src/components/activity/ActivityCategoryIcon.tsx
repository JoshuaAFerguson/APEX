/**
 * ActivityCategoryIcon Component
 *
 * Displays appropriate icons for different activity event categories.
 * Uses lucide-react icons consistent with the existing design system.
 */

import React from 'react'
import {
  CheckSquare,    // task
  Bot,            // agent
  Wrench,         // tool
  ShieldCheck,    // gate (approval)
  Lock,           // permission
  Settings,       // system
  AlertTriangle,  // error
} from 'lucide-react'
import type { ActivityEventCategory } from '../../types/dashboard'

/**
 * Props for ActivityCategoryIcon component
 */
export interface ActivityCategoryIconProps {
  /** Event category to display icon for */
  category: ActivityEventCategory
  /** Optional className for styling */
  className?: string
  /** Icon size (default: 16) */
  size?: number
}

/**
 * Icon mapping for event categories
 */
export type CategoryIconMap = Record<ActivityEventCategory, React.ComponentType<any>>

/**
 * Icon mapping for event categories
 */
const CATEGORY_ICONS: CategoryIconMap = {
  task: CheckSquare,
  agent: Bot,
  tool: Wrench,
  gate: ShieldCheck,
  permission: Lock,
  system: Settings,
  error: AlertTriangle,
} as const

/**
 * ActivityCategoryIcon component renders an appropriate icon for the given category
 */
export function ActivityCategoryIcon({
  category,
  className,
  size = 16
}: ActivityCategoryIconProps) {
  const IconComponent = CATEGORY_ICONS[category]

  if (!IconComponent) {
    // Fallback to Settings icon for unknown categories
    return <Settings className={className} size={size} />
  }

  return <IconComponent className={className} size={size} />
}