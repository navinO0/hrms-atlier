import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  const table = await queryInterface.describeTable("AttendanceLogs");
  if (!table.isAutoCheckout) {
    await queryInterface.addColumn("AttendanceLogs", "isAutoCheckout", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  }
  if (!table.overrideOtHours) {
    await queryInterface.addColumn("AttendanceLogs", "overrideOtHours", {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: null,
    });
  }
  if (!table.regularizationStatus) {
    await queryInterface.addColumn("AttendanceLogs", "regularizationStatus", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "None",
    });
  }
  if (!table.regularizedCheckOut) {
    await queryInterface.addColumn("AttendanceLogs", "regularizedCheckOut", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    });
  }
  if (!table.regularizationReason) {
    await queryInterface.addColumn("AttendanceLogs", "regularizationReason", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    });
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn("AttendanceLogs", "isAutoCheckout");
  await queryInterface.removeColumn("AttendanceLogs", "overrideOtHours");
  await queryInterface.removeColumn("AttendanceLogs", "regularizationStatus");
  await queryInterface.removeColumn("AttendanceLogs", "regularizedCheckOut");
  await queryInterface.removeColumn("AttendanceLogs", "regularizationReason");
}
