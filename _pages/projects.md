---
layout: page
title: projects
permalink: /projects/
description: 
nav: true
rank: 2
---
##### **Modelling biological networks using formal language**
*Aug 2020 - Present* 

*Department of Computer Science, BITS Pilani*

I am working under [Prof. Rajesh Kumar](https://www.bits-pilani.ac.in/pilani/rajeshk/profile) where I am researching ways to analyze biological networks such as gene regulatory networks (GRNs), with the help of formal language and automata theory. Specifically, we are working on the fault analysis of GRNs to understand the effect of induced drugs. We are currently working on modelling stochasticity in GRNs using probabilistic boolean networks. 

---

##### **Prediction of coronary heart disease with data mining and machine learning**
*Aug 2020 - Present* 

*Department of Biological Sciences, BITS Pilani*

I am working under [Prof. Syamantak Majumder](https://www.bits-pilani.ac.in/pilani/syamantakmajumder/profile) to understand the biological paramaters influencing heart diseases with machine learning, using data from hospital patients. Currently I am working on comparing various machine learning and deep learning models for their best performance on the task.

---

##### **Analysis of the neural patterns betweeen face and shape recognition**
*Neuromatch Academy*

*July 2020* 

The [Neuromatch Academy](https://www.neuromatchacademy.org/) was a summer school where we were trained on learning computational tools and apply them to real-life neuroscience research problems. Some of the topics which interested me the most were dynanimcal networks, bayesian statistics, and optimal control. As part of the group project, we worked on the [Human Connectome Project (HCP)](https://www.humanconnectome.org/study/hcp-young-adult/data-releases) dataset, where we analysed the neural patterns between face and shape recognition in the brain.

---

##### **Protein engineering with deep learning**
*RWTH Aachen University, Germany*

*May - July 2020*

I worked as a research intern at the [Institute of Biotechnology](https://www.biotec.rwth-aachen.de/cms/~imne/BIOTEC/lidx/1/) under Prof. Mehdi D. Davari. I worked on the prediction of biophysical properties of enzymes created through directed evoultion, a process mimicking natural selection. I experimented with various machine learning and deep learning models for choosing the best performing model for the required task, and analyzed high throughput data for protein mutation samples. 

---

##### **Machine learning for cancer prognosis using biomedical image data**
*Department of Biological Sciences, BITS Pilani*

*May - July 2020*

I worked under [Prof. Meghana Tare](https://www.bits-pilani.ac.in/pilani/meghanatare/profile) to analyze biomedical image samples with machine learning and deep learning models. I performed biomedical image segmentation with the help of convolutional neural networks, and classified the MR images using the 3-D voxel data.

---

##### **Custom JupyterHub AWS instance with automated load balancing using Kubernetes**
*UST Global, Trivandrum, India*

*May - July 2019*

I worked as a software development intern at the research center of the company, Infinity Labs. I worked on developing a proof of concept AWS JupyterHub cluster using Kubernetes for internal company resources to explore and prototype machine learning models without local installation and dependices. I also worked on automating the load management for each user's instance, along with a custom login protocol based on an internal authentication method of the organization.

<!--
<div class="projects grid">

  {% assign sorted_projects = site.projects | sort: "importance" %}
  {% for project in sorted_projects %}
  <div class="grid-item">
    {% if project.redirect %}
    <a href="{{ project.redirect }}" target="_blank">
    {% else %}
    <a href="{{ project.url | relative_url }}">
    {% endif %}
      <div class="card hoverable">
        {% if project.img %}
        <img src="{{ project.img | relative_url }}" alt="project thumbnail">
        {% endif %}
        <div class="card-body">
          <h2 class="card-title text-lowercase">{{ project.title }}</h2>
          <p class="card-text">{{ project.description }}</p>
          <div class="row ml-1 mr-1 p-0">
            {% if project.github %}
            <div class="github-icon">
              <div class="icon" data-toggle="tooltip" title="Code Repository">
                <a href="{{ project.github }}" target="_blank"><i class="fab fa-github gh-icon"></i></a>
              </div>
              {% if project.github_stars %}
              <span class="stars" data-toggle="tooltip" title="GitHub Stars">
                <i class="fas fa-star"></i>
                <span id="{{ project.github_stars }}-stars"></span>
              </span>
              {% endif %}
            </div>
            {% endif %}
          </div>
        </div>
      </div>
    </a>
  </div>
{% endfor %}

</div>
-->



