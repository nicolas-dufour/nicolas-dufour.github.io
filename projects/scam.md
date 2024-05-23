---
layout: project
permalink: /scam
title: SCAM! Transferring humans between images with Semantic Cross Attention Modulation
short_name: SCAM
author: Nicolas Dufour
description: This work introduces SCAM, a system for semantically conditioned image generation that targets both pose and subject transfer. Unlike existing methods, SCAM encodes rich information in each semantic region, including foreground and background, enabling precise generation with fine details. This is achieved through a Semantic Attention Transformer Encoder that extracts multiple latent vectors per region, and a generator that leverages these latents via cross-attention modulation. Our approach outperforms SEAN and SPADE on the iDesigner and CelebAMask-HD datasets, setting a new state-of-the-art for subject transfer.
keywords: image generation, semantic image synthesis, subject transfer, attention, transformer, GAN, SCAM, SEAN, SPADE
analytics: https://www.googletagmanager.com/gtag/js?id=G-V8HK2ZSXGW

paper_title: SCAM! Transferring humans between images with Semantic Cross Attention Modulation
paper_authors: <a href="/">Nicolas Dufour</a>, <a href="https://davidpicard.github.io/">David Picard</a>, <a href="http://vicky.kalogeiton.info/">Vicky Kalogeiton</a>
journal: ECCV 2022
buttons:
  - type: github
    text: Code
    url: https://github.com/nicolas-dufour/SCAM
  - type: arxiv
    text: Paper
    url: https://arxiv.org/abs/2210.04883
  - type: pdf
    text: Poster
    url: /assets/publications/scam/poster.pdf
  - type: video
    text: Video
    url: https://www.youtube.com/watch?v=YzROtpjuSaQ

abstract:  A large body of recent work targets semantically conditioned image generation. Most such methods focus on the narrower task of pose transfer and ignore the more challenging task of subject transfer that consists in not only transferring the pose but also the appearance and background. In this work, we introduce SCAM (Semantic Cross Attention Modulation), a system that encodes rich and diverse information in each semantic region of the image (including foreground and background), thus achieving precise generation with emphasis on fine details. This is enabled by the Semantic Attention Transformer Encoder that extracts multiple latent vectors for each semantic region, and the corresponding generator that exploits these multiple latents by using semantic cross attention modulation. It is trained only using a reconstruction setup, while subject transfer is performed at test time. Our analysis shows that our proposed architecture is successful at encoding the diversity of appearance in each semantic region. Extensive experiments on the iDesigner and CelebAMask-HD datasets show that SCAM outperforms SEAN and SPADE; moreover, it sets the new state of the art on subject transfer.
poster: 
    url: /assets/publications/scam/poster.pdf
video: 
    url: https://www.youtube.com/embed/YzROtpjuSaQ
bibtex: "@article{dufour2022scam,\n  title={SCAM! Transferring humans between images with Semantic Cross Attention Modulation},\n  author={Nicolas Dufour, David Picard, Vicky Kalogeiton},\n  booktitle={Proceedings of the European Conference on Computer Vision (ECCV)},\n  year=2022}\n}"
acknowledgements: We would like to thank Dimitrios Papadopoulos, Monika Wysoczanska, Philippe Chiberre and Thibaut Issenhuth for proofreading. We would also like to thank Simon Ebel for the help with the video. This work was granted access to the HPC resources of IDRIS under the allocation 2021-AD011012630 made by GENCI and was supported by a DIM RFSI grant and ANR project TOSAI ANR-20-IADJ-0009.
---

<div class="section">
    <h2 id="Pipeline">Pipeline</h2>
    <figure style="width:80%; margin:auto; display: block;">
        <img src="/assets/publications/scam/images/teaser.png">
        <figcaption>Figure 1: Pipeline of our method. We have trained an encoder-generator architecture. The encoder
        assigns multiple style codes for each semantic region of the image. We can then mix the style codes such
        as we keep the background style code from one image and transfer the subject appearance from another. We
        then use the semantic aware generator (SCAM) with the desired segmentation mask and the respective style
        code to generate the final image</figcaption>
    </figure>
</div>