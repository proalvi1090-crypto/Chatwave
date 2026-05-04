import PropTypes from "prop-types";

import PropTypes from "prop-types";

export default function Button({ children, className = "", ...props }) {
  return (
    <button
      className={`rounded-xl bg-gradient-to-r from-[#6366f1] via-[#7c3aed] to-[#8b5cf6] px-4 py-2 font-medium text-white transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-500/30 ${className}`}
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

Button.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string
};
