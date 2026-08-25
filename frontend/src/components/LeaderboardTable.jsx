
function LeaderboardTable(){
    const data = [
    { id: 1, name: "Alice", age: 28, city: "New York" },
    { id: 2, name: "Bob", age: 34, city: "London" },
    { id: 3, name: "Carol", age: 22, city: "Tokyo" },
  ];

    return (
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Age</th>
                    <th>City</th>
                </tr>
            </thead>

            <tbody>
                {data.map((row) => (
                    <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.age}</td>
                        <td>{row.city}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default LeaderboardTable;