/** Decorative pixel bolt; the surrounding cost or meter supplies the accessible label. */
export function EnergyIcon() {
  return (
    <svg className="energy-icon" viewBox="0 0 20 28" aria-hidden="true" focusable="false">
      <path
        fill="#88501c"
        d="M8 1H19V5H17V9H15V11H20V15H17V19H14V22H11V25H8V28H4V20H6V17H1V13H3V9H5V5H7V1Z"
      />
      <path
        fill="#ffc43d"
        d="M9 2H17V4H15V8H13V12H18V14H15V18H12V21H9V24H6V20H8V16H3V13H5V9H7V5H9Z"
      />
      <path fill="#ffe993" d="M9 2H17V4H11V8H9V12H7V14H3V13H5V9H7V5H9Z" />
      <path fill="#f49a27" d="M13 12H18V14H15V18H12V21H9V24H6V22H8V19H11V15H13Z" />
    </svg>
  );
}
