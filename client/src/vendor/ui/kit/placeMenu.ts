/* placeMenu — where a popup menu goes, in viewport (position: fixed) coordinates.
   Below the trigger when it fits, above when there is more room there; the list
   height shrinks to the room left so the menu never leaves the viewport. */

export interface MenuPlacement {
  left: number;
  width: number;
  /** Set when the menu opens below the trigger. */
  top?: number;
  /** Set when the menu opens above the trigger (distance from the viewport bottom). */
  bottom?: number;
  /** Max height of the scrolling option list. */
  listMaxHeight: number;
}

/** Search row + list padding around the options. */
export const MENU_CHROME_PX = 60;
const GAP = 6;
const MARGIN = 8;
const MIN_LIST = 120;

export function placeMenu(
  trigger: { top: number; bottom: number; left: number; width: number },
  viewportHeight: number,
  maxListHeight: number,
): MenuPlacement {
  const below = viewportHeight - trigger.bottom - GAP - MARGIN;
  const above = trigger.top - GAP - MARGIN;
  const wanted = maxListHeight + MENU_CHROME_PX;
  const openUp = below < wanted && above > below;
  const room = openUp ? above : below;
  const listMaxHeight = Math.max(MIN_LIST, Math.min(maxListHeight, room - MENU_CHROME_PX));
  return openUp
    ? { left: trigger.left, width: trigger.width, bottom: viewportHeight - trigger.top + GAP, listMaxHeight }
    : { left: trigger.left, width: trigger.width, top: trigger.bottom + GAP, listMaxHeight };
}
