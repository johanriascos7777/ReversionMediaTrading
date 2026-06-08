-- ============================================================
-- ElasticityMeter — Torre de Control
-- Script de creación de tabla: trading_journal.trade
--
-- Ejecutar:
--   mysql -u root -p trading_journal < create-trade-table.sql
-- O desde la consola MySQL:
--   USE trading_journal;
--   SOURCE /ruta/a/create-trade-table.sql;
-- ============================================================

USE trading_journal;

CREATE TABLE IF NOT EXISTS `trade` (
  -- Identificación
  `id`                        INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `symbol`                    VARCHAR(20)  NOT NULL COMMENT 'EUR/USD, GBP/USD, etc.',
  `direction`                 VARCHAR(4)   NOT NULL COMMENT 'BUY | SELL',
  `trade_type`                VARCHAR(12)  NOT NULL COMMENT 'scalping | swing | positional',
  `session`                   VARCHAR(12)  NOT NULL COMMENT 'asian | european | american | pacific',

  -- Precios y configuración
  `entry_price`               DECIMAL(12,5) NOT NULL,
  `exit_price`                DECIMAL(12,5) NULL,
  `leverage`                  INT          NOT NULL,
  `spread`                    DECIMAL(8,5) NOT NULL COMMENT 'Spread en precio (ej: 0.00013)',
  `investment_amount`         DECIMAL(10,2) NOT NULL COMMENT 'Capital invertido en USD',
  `liquidation_theoretical`   DECIMAL(12,5) NULL COMMENT 'Precio liquidación sin spread',
  `liquidation_real`          DECIMAL(12,5) NULL COMMENT 'Precio liquidación con spread',

  -- Señales auto-capturadas al entrar
  `elasticity_m5_state`       VARCHAR(6)   NULL COMMENT 'GREEN | YELLOW | RED',
  `elasticity_m15_state`      VARCHAR(6)   NULL COMMENT 'GREEN | YELLOW | RED',
  `fused_state`               VARCHAR(6)   NULL COMMENT 'GREEN | YELLOW | RED',
  `elasticity_m5_value`       DECIMAL(8,4) NULL,
  `elasticity_m15_value`      DECIMAL(8,4) NULL,
  `structure_state`           VARCHAR(8)   NULL COMMENT 'STRONG | MODERATE | WEAK',
  `structure_signal`          VARCHAR(4)   NULL COMMENT 'BUY | SELL | WAIT',
  `rsi_at_entry`              DECIMAL(6,2) NULL,
  `divergence_at_entry`       VARCHAR(8)   NULL COMMENT 'bearish | bullish | none',
  `ema200_slope_at_entry`     VARCHAR(4)   NULL COMMENT 'up | down | flat',
  `nearest_s_r_price`         DECIMAL(12,5) NULL,
  `nearest_s_r_type`          VARCHAR(12)  NULL COMMENT 'resistance | support',
  `nearest_s_r_strength`      INT          NULL,
  `nearest_s_r_distance`      DECIMAL(6,4) NULL COMMENT 'Distancia en ATR',
  `contextual_win_rate`       DECIMAL(6,2) NULL COMMENT 'Win rate contextual del backtest',
  `contextual_cases`          INT          NULL COMMENT 'Casos similares en el backtest',

  -- Tiempos
  `opened_at`                 DATETIME     NOT NULL,
  `closed_at`                 DATETIME     NULL,
  `minutes_in_holgura`        INT          NULL COMMENT 'Minutos en zona de tolerancia antes de ser positivo',
  `minutes_in_profit`         INT          NULL COMMENT 'Minutos en zona positiva',
  `total_minutes_open`        INT          NULL COMMENT 'Duración total de la operación',

  -- Resultado
  `mae`                       DECIMAL(10,4) NULL COMMENT 'Max Adverse Excursion en USD',
  `mfe`                       DECIMAL(10,4) NULL COMMENT 'Max Favorable Excursion en USD',
  `pnl`                       DECIMAL(10,4) NULL COMMENT 'Ganancia/pérdida final en USD',
  `pnl_percent`               DECIMAL(8,2)  NULL COMMENT 'P&L como % sobre la inversión',
  `close_reason`              VARCHAR(8)   NULL COMMENT 'tp | sl | signal | manual | time',
  `outcome`                   VARCHAR(10)  NOT NULL DEFAULT 'open' COMMENT 'win | loss | breakeven | open',
  `trade_mode`                VARCHAR(15)  NOT NULL DEFAULT 'normal' COMMENT 'normal | experimental',
  `has_type_c`                TINYINT(1)   NULL DEFAULT NULL COMMENT 'Alerta Tipo C al entrar (true/false/null)',


  -- Notas
  `notes`                     TEXT         NULL,

  -- Timestamps automáticos
  `created_at`                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Índices para analytics rápidos
  INDEX `idx_outcome`   (`outcome`),
  INDEX `idx_session`   (`session`),
  INDEX `idx_symbol`    (`symbol`),
  INDEX `idx_opened_at` (`opened_at`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Bitácora de operaciones — ElasticityMeter Torre de Control';

SELECT 'Tabla trade creada exitosamente en trading_journal' AS resultado;
