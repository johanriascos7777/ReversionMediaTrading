// src/components/01-atoms/Pairs/Pairs.tsx

import styles from './Pairs.module.scss';

interface PairsProps {
  base: string;
  quote: string;
  color?: 'green' | 'white';
}

export const Pairs = ({ base, quote, color = 'green' }: PairsProps) => {
  return (
    <div className={styles.pairs}>
      <h1 className={`${styles.pairs__title} ${styles[color]}`}>
        {base}/<span>{quote}</span>
      </h1>
    </div>
  );
};