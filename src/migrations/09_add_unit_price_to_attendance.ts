import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Add unitPrice to AttendanceLogs — per-piece rate for piece-work earnings
  await queryInterface.addColumn("AttendanceLogs", "unitPrice", {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: null,
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn("AttendanceLogs", "unitPrice");
}
