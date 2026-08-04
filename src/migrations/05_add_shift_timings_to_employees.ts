import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  const table = await queryInterface.describeTable("Employees");

  if (!table.checkInTime) {
    await queryInterface.addColumn("Employees", "checkInTime", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "09:00",
    });
  }

  if (!table.checkOutTime) {
    await queryInterface.addColumn("Employees", "checkOutTime", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "18:00",
    });
  }

  if (!table.employmentType) {
    await queryInterface.addColumn("Employees", "employmentType", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Full-Time",
    });
  }

  if (!table.breakTime) {
    await queryInterface.addColumn("Employees", "breakTime", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 60,
    });
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn("Employees", "checkInTime");
  await queryInterface.removeColumn("Employees", "checkOutTime");
  await queryInterface.removeColumn("Employees", "employmentType");
  await queryInterface.removeColumn("Employees", "breakTime");
}
