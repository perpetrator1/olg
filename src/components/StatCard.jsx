import React from 'react';
import CountUp from 'react-countup';
import { motion } from 'framer-motion';

const SafeCountUp = CountUp.default || CountUp;

export const StatCard = ({ title, value, icon: Icon, prefix = '', suffix = '', color = 'accent', index = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className="card p-6 flex items-center gap-4"
    >
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center bg-${color}/20 text-${color} text-accent`}>
        {Icon && <Icon className="h-6 w-6" />}
      </div>
      <div>
        <h3 className="text-sm font-medium text-slate-400">{title}</h3>
        <p className="text-2xl font-bold text-white mt-1">
          {prefix}
          <SafeCountUp end={typeof value === 'number' ? value : parseInt(value) || 0} duration={2} separator="," />
          {suffix}
        </p>
      </div>
    </motion.div>
  );
};
