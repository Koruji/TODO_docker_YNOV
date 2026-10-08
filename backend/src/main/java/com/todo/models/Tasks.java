package com.todo.models;
import java.time.LocalDate;

import jakarta.persistence.*;

@Entity 
@Table(name = "tasks")
public class Tasks {
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String label;

    @Column(nullable = false)
    private String description;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(length = 255)
    private String place;

    private Integer level;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private Users user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "collaborator_id")
    private Users collaborator;

    protected Tasks() {}

    public Tasks(String label, String description, Users user) {
        this.label = label;
        this.description = description;
        this.user = user;
    }

    // -- Getters & setters
    public Long getId() { return id; }
    public String getLabel() { return label; }
    public String getDescription() { return description; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public String getPlace() { return place; }
    public Integer getLevel() { return level; }
    public Users getUser() { return user; }
    public Users getCollaborator() { return collaborator; }

    public void setLabel(String label) { this.label = label; }
    public void setDescription(String description) { this.description = description; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public void setPlace(String place) { this.place = place; }
    public void setLevel(Integer level) { this.level = level; }
    public void setUser(Users user) { this.user = user; }
    public void setCollaborator(Users collaborator) { this.collaborator = collaborator; }

}
