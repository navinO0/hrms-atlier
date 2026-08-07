import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Add pieceCount to AttendanceLogs — used when employee pay type is "Per Unit"
  await queryInterface.addColumn("AttendanceLogs", "pieceCount", {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn("AttendanceLogs", "pieceCount");
}
