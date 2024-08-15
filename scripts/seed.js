import { PrismaClient } from '@prisma/client';

const client = new PrismaClient();

const datasetsToCreate = [
    {
        id: '1',
        name: 'Dataset 1',
        data: [
            {
                id: '1',
                weight: "10kg",
                year: 2004,
            },
            {
                name: 'Data 2',
                value: 2,
            },
        ],
    },
    {
        id: '2',
        name: 'Dataset 2',
        data: [
            {
                name: 'Data 1',
                value: 3,
            },
            {
                name: 'Data 2',
                value: 4,
            },
        ],
    },
];

const seed = async (datasets) => { 
    console.log('Seeding data...');

    for (const dataset of datasets) {
        console.log('creating dataset:', dataset.name);
        await client.datasets.upsert({
            where: { id: dataset.id },
            update: dataset,
            create: dataset,
        });
    }
}

seed(datasetsToCreate)
    .then(() => {
        console.log('Data seeded successfully.');
    })
    .catch((error) => {
        console.error('Error seeding data:', error);
    })
    .finally(() => {
        client.$disconnect();
        console.log('Disconnected from database.');
    });