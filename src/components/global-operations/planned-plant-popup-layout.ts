export type PopupPlacement = "top" | "bottom";

export type PopupLayout = {
  left: number;
  top: number;
  placement: PopupPlacement;
};

type PopupLayoutInput = {
  anchorX: number;
  anchorY: number;
  containerWidth: number;
  containerHeight: number;
  panelWidth: number;
  panelHeight: number;
  safeTop?: number;
  safeBottom?: number;
  safeLeft?: number;
  safeRight?: number;
};

export function resolveAnchoredPopupLayout({
  anchorX,
  anchorY,
  containerWidth,
  containerHeight,
  panelWidth,
  panelHeight,
  safeTop = 96,
  safeBottom = 84,
  safeLeft = 24,
  safeRight = 24,
}: PopupLayoutInput): PopupLayout {
  const maxLeft = Math.max(safeLeft, containerWidth - safeRight - panelWidth);
  const left = Math.min(
    Math.max(anchorX - panelWidth / 2, safeLeft),
    maxLeft,
  );

  const canPlaceBottom =
    anchorY < panelHeight + safeTop &&
    containerHeight - anchorY > panelHeight + safeBottom;

  return {
    left,
    top: anchorY,
    placement: canPlaceBottom ? "bottom" : "top",
  };
}
