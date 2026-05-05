import PropTypes from "prop-types";

export default function Avatar({ src, name, size = "md" }) {
  const classes = size === "lg" ? "h-14 w-14" : "h-10 w-10";
  return src ? (
    <img src={src} alt={name} className={`${classes} rounded-full object-cover ring-1 ring-white/15 shadow-lg shadow-indigo-900/20`} />
  ) : (
    <div className={`${classes} flex items-center justify-center rounded-full brand-gradient text-xs font-semibold text-white ring-1 ring-white/15 shadow-lg shadow-[#c0c1ff]/20`}>
      {(name || "?").slice(0, 2).toUpperCase()}
    </div>
  );
}

Avatar.propTypes = {
  src: PropTypes.string,
  name: PropTypes.string,
  size: PropTypes.oneOf(["md", "lg"])
};
