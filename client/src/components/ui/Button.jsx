import PropTypes from "prop-types";

export default function Button({ children, className = "", ...props }) {
  return (
    <button
      className={`brand-gradient rounded-full px-4 py-2 font-bold transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#c0c1ff]/30 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string
};
