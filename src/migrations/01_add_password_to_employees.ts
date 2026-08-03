import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  const tableInfo = await queryInterface.describeTable("Employees");
  if (!tableInfo.password) {
    await queryInterface.addColumn("Employees", "password", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "password"
    });
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  const tableInfo = await queryInterface.describeTable("Employees");
  if (tableInfo.password) {
    await queryInterface.removeColumn("Employees", "password");
  }
}
