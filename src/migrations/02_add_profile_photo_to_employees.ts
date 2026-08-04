import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  const tableInfo = await queryInterface.describeTable("Employees");
  if (!tableInfo.profilePhoto) {
    await queryInterface.addColumn("Employees", "profilePhoto", {
      type: DataTypes.TEXT,
      allowNull: true
    });
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  const tableInfo = await queryInterface.describeTable("Employees");
  if (tableInfo.profilePhoto) {
    await queryInterface.removeColumn("Employees", "profilePhoto");
  }
}
