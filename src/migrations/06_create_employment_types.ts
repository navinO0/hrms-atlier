import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface) {
  await queryInterface.createTable("EmploymentTypes", {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    standardHours: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 8.0,
    },
    minHoursForBreak: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 5.0,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // Pre-seed default employment types:
  const now = new Date();
  await queryInterface.bulkInsert("EmploymentTypes", [
    {
      id: "et-fulltime",
      name: "Full-Time",
      standardHours: 8.0,
      minHoursForBreak: 5.0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "et-parttime",
      name: "Part-Time",
      standardHours: 4.0,
      minHoursForBreak: 5.0,
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable("EmploymentTypes");
}
