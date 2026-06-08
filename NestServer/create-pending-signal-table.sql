-- ============================================================
-- ElasticityMeter — Torre de Control
-- Script de creación de tabla: trading_journal.pending_signal
--
-- Ejecutar:
--   mysql -u root -p trading_journal < create-pending-signal-table.sql
-- ============================================================

USE trading_journal;

CREATE TABLE IF NOT EXISTS `pending_signal` (
  `id`                        INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `symbol`                    VARCHAR(20)  NOT NULL,
  `direction`                 VARCHAR(4)   NOT NULL,
  `trade_mode`                VARCHAR(15)  NOT NULL DEFAULT 'experimental',
  `status`                    VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT 'pending | approved | discarded_active | discarded_win | discarded_loss | discarded_timeout',
  `entry_price`               DECIMAL(12,5) NOT NULL COMMENT 'Precio de la alerta en vivo',
  `tp_price`                  DECIMAL(12,5) NOT NULL COMMENT 'Take profit recomendado al dispararse',
  `sl_price`                  DECIMAL(12,5) NOT NULL COMMENT 'Stop loss recomendado al dispararse',
  `session`                   VARCHAR(12)  NOT NULL,
  
  -- Variables Técnicas Congeladas (Snapshot)
  `elasticity_m5_state`       VARCHAR(6)   NULL,
  `elasticity_m15_state`      VARCHAR(6)   NULL,
  `fused_state`               VARCHAR(6)   NULL,
  `elasticity_m5_value`       DECIMAL(8,4) NULL,
  `elasticity_m15_value`      DECIMAL(8,4) NULL,
  `structure_state`           VARCHAR(8)   NULL,
  `structure_signal`          VARCHAR(4)   NULL,
  `rsi_at_entry`              DECIMAL(6,2) NULL,
  `divergence_at_entry`       VARCHAR(8)   NULL,
  `ema200_slope_at_entry`     VARCHAR(4)   NULL,
  `nearest_s_r_price`         DECIMAL(12,5) NULL,
  `nearest_s_r_type`          VARCHAR(12)  NULL,
  `nearest_s_r_strength`      INT          NULL,
  `nearest_s_r_distance`      DECIMAL(6,4) NULL,
  `contextual_win_rate`       DECIMAL(6,2) NULL,
  `contextual_cases`          INT          NULL,
  `has_type_c`                TINYINT(1)   NULL DEFAULT 0,
  `has_pedestrian_light`      TINYINT(1)   NULL DEFAULT 0,

  -- Timestamps y resultados virtuales (para Fomowatch)
  `opened_at`                 DATETIME     NOT NULL,
  `closed_at`                 DATETIME     NULL,
  `total_minutes_open`        INT          NULL,
  `pnl`                       DECIMAL(10,4) NULL,
  
  `created_at`                DATETIME     NOT NULL,
  `updated_at`                DATETIME     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
